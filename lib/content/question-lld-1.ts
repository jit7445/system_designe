import type { QuestionLLD } from "../types";

export const QUESTION_LLD_1: Record<string, QuestionLLD> = {
  "url-shortener": {
    classDiagram: `classDiagram
  class UrlController {
    -UrlService urlService
    +create(CreateUrlRequest req) ResponseEntity
    +redirect(String shortKey) ResponseEntity
  }
  class UrlService {
    -KeyGenerator keyGen
    -UrlRepository repo
    -UrlCache cache
    -ClickEventPublisher clicks
    +shorten(String longUrl, String alias, Instant expiry) UrlMapping
    +resolve(String shortKey) Optional~String~
  }
  class KeyGenerator {
    <<interface>>
    +nextKey() String
  }
  class KeyGenerationService {
    -BlockingQueue~String~ localPool
    -KeyStore keyStore
    +nextKey() String
    -refill() void
  }
  class KeyStore {
    -Set~String~ unusedKeys
    +claimBatch(int size) List~String~
  }
  class UrlMapping {
    -String shortKey
    -String longUrl
    -long userId
    -Instant createdAt
    -Instant expiresAt
    +isExpired(Instant now) boolean
  }
  class UrlRepository {
    <<interface>>
    +save(UrlMapping m) void
    +findByKey(String shortKey) Optional~UrlMapping~
  }
  class CassandraUrlRepository {
    +save(UrlMapping m) void
    +findByKey(String shortKey) Optional~UrlMapping~
  }
  class UrlCache {
    +get(String shortKey) String
    +put(String shortKey, String longUrl, Duration ttl) void
  }
  class ClickEventPublisher {
    +publish(String shortKey, String ip) void
  }
  UrlController --> UrlService
  UrlService --> KeyGenerator
  UrlService --> UrlRepository
  UrlService --> UrlCache
  UrlService --> ClickEventPublisher
  KeyGenerator <|.. KeyGenerationService
  KeyGenerationService "1" --> "1" KeyStore : claims batches
  UrlRepository <|.. CassandraUrlRepository
  UrlRepository "1" --> "many" UrlMapping : stores`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant API as UrlController
  participant S as UrlService
  participant K as KeyGenerationService
  participant R as Redis Cache
  participant DB as URL Store
  C->>API: POST /api/v1/urls long_url
  API->>S: shorten(longUrl)
  S->>K: nextKey()
  K-->>S: aZ3kP9q
  S->>DB: save(aZ3kP9q, longUrl)
  S-->>API: UrlMapping
  API-->>C: 201 Created short_url
  C->>API: GET /aZ3kP9q
  API->>S: resolve(aZ3kP9q)
  S->>R: get(aZ3kP9q)
  alt cache hit
    R-->>S: longUrl
  else cache miss
    R-->>S: null
    S->>DB: findByKey(aZ3kP9q)
    DB-->>S: UrlMapping
    S->>R: put(aZ3kP9q, longUrl, ttl)
  end
  S-->>API: longUrl
  API-->>C: 302 Location longUrl`,
    sequenceCaption: "Creating a short link with a pre-generated key, then redirecting it through the cache-aside read path.",
    code: {
      lang: "java",
      caption: "The app-server side of the Key Generation Service: random base62 keys are claimed in batches so the write path never checks for collisions.",
      code: `import java.security.SecureRandom;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

public class KeyGenerationService implements KeyGenerator {

    private static final char[] ALPHABET =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();
    private static final int KEY_LENGTH = 7;

    private final KeyStore keyStore;
    private final int batchSize;
    private final BlockingQueue<String> localPool;

    public KeyGenerationService(KeyStore keyStore, int batchSize) {
        this.keyStore = keyStore;
        this.batchSize = batchSize;
        this.localPool = new ArrayBlockingQueue<>(batchSize);
    }

    @Override
    public String nextKey() {
        String key = localPool.poll();
        if (key == null) {
            refill();
            key = localPool.poll();
        }
        if (key == null) {
            throw new IllegalStateException("Key store exhausted");
        }
        return key;
    }

    // Claimed keys are marked used in the store before we see them, so a crash
    // only wastes the unissued part of the batch; it never hands out a key twice.
    private synchronized void refill() {
        if (!localPool.isEmpty()) {
            return;
        }
        List<String> batch = keyStore.claimBatch(batchSize);
        localPool.addAll(batch);
    }

    public static String randomKey(SecureRandom rng) {
        char[] out = new char[KEY_LENGTH];
        for (int i = 0; i < KEY_LENGTH; i++) {
            out[i] = ALPHABET[rng.nextInt(ALPHABET.length)];
        }
        return new String(out);
    }

    // Offline job: fills the key store ahead of demand, away from the hot path.
    public static Set<String> pregenerate(int count, Set<String> alreadyIssued) {
        SecureRandom rng = new SecureRandom();
        Set<String> fresh = new HashSet<>(count * 2);
        while (fresh.size() < count) {
            String candidate = randomKey(rng);
            if (!alreadyIssued.contains(candidate)) {
                fresh.add(candidate);
            }
        }
        return fresh;
    }

    // Alternative scheme from the lesson: base62-encode a counter range from ZooKeeper.
    public static String encodeBase62(long value) {
        if (value == 0) {
            return String.valueOf(ALPHABET[0]);
        }
        StringBuilder sb = new StringBuilder();
        while (value > 0) {
            sb.append(ALPHABET[(int) (value % 62)]);
            value /= 62;
        }
        return sb.reverse().toString();
    }

    public static long decodeBase62(String key) {
        long result = 0;
        for (char c : key.toCharArray()) {
            result = result * 62 + indexOf(c);
        }
        return result;
    }

    private static int indexOf(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'z') return c - 'a' + 10;
        if (c >= 'A' && c <= 'Z') return c - 'A' + 36;
        throw new IllegalArgumentException("Not a base62 character: " + c);
    }
}`,
    },
    patterns: [
      { name: "Strategy", where: "KeyGenerator is an interface, so the pre-generated KGS and the base62 counter scheme can be swapped without touching UrlService." },
      { name: "Repository", where: "UrlRepository hides Cassandra or DynamoDB behind save and findByKey, keeping the service storage-agnostic." },
      { name: "Cache-aside", where: "UrlService.resolve reads Redis first, falls back to the URL store and back-fills the cache on a miss." },
      { name: "Object pool", where: "KeyGenerationService keeps a local pool of claimed keys and refills it in batches." },
    ],
  },

  "rate-limiter": {
    classDiagram: `classDiagram
  class RateLimitFilter {
    -RateLimiterService limiter
    +doFilter(HttpRequest req, FilterChain chain) void
  }
  class RateLimiterService {
    -RuleRepository rules
    -AlgorithmFactory factory
    -FailurePolicy failurePolicy
    +check(String clientId, String endpoint) Decision
  }
  class Rule {
    -String endpoint
    -String tier
    -AlgorithmType algorithm
    -long limit
    -Duration window
  }
  class RuleRepository {
    <<interface>>
    +findRule(String endpoint, String tier) Rule
    +reload() void
  }
  class RateLimitAlgorithm {
    <<interface>>
    +tryAcquire(String key, Rule rule) Decision
  }
  class TokenBucketAlgorithm {
    -Map~String,Bucket~ buckets
    +tryAcquire(String key, Rule rule) Decision
  }
  class SlidingWindowCounterAlgorithm {
    -RedisClient redis
    -String luaScriptSha
    +tryAcquire(String key, Rule rule) Decision
  }
  class AlgorithmFactory {
    +forType(AlgorithmType type) RateLimitAlgorithm
  }
  class Decision {
    -boolean allowed
    -long remaining
    -long retryAfterSeconds
  }
  class FailurePolicy {
    <<enumeration>>
    FAIL_OPEN
    FAIL_CLOSED
  }
  RateLimitFilter --> RateLimiterService
  RateLimiterService --> RuleRepository
  RateLimiterService --> AlgorithmFactory
  RateLimiterService --> FailurePolicy
  RuleRepository "1" --> "many" Rule
  AlgorithmFactory ..> RateLimitAlgorithm : creates
  RateLimitAlgorithm <|.. TokenBucketAlgorithm
  RateLimitAlgorithm <|.. SlidingWindowCounterAlgorithm
  RateLimitAlgorithm ..> Decision : returns`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant F as RateLimitFilter
  participant L as RateLimiterService
  participant RR as RuleRepository
  participant R as Redis Counters
  participant SVC as Service
  C->>F: GET /api/v1/orders
  F->>L: check(apiKey, /orders)
  L->>RR: findRule(/orders, tier)
  RR-->>L: Rule 100 per minute
  L->>R: EVALSHA sliding window script
  alt Redis unavailable
    R-->>L: timeout
    L-->>F: Decision allowed by FAIL_OPEN
  else under limit
    R-->>L: allowed, remaining 42
    L-->>F: Decision allowed
    F->>SVC: forward request
    SVC-->>F: 200 OK
    F-->>C: 200 OK X-RateLimit-Remaining 42
  else limit exceeded
    R-->>L: rejected, retry in 30s
    L-->>F: Decision rejected
    F-->>C: 429 Too Many Requests Retry-After 30
  end`,
    sequenceCaption: "A request passing through the gateway rate-limit filter, with allowed, rejected and fail-open branches.",
    code: {
      lang: "java",
      caption: "A thread-safe token bucket strategy keyed by client and endpoint; production runs the same refill math inside a Redis Lua script so the limit is global.",
      code: `import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public class TokenBucketAlgorithm implements RateLimitAlgorithm {

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;

    public TokenBucketAlgorithm(Clock clock) {
        this.clock = clock;
    }

    @Override
    public Decision tryAcquire(String key, Rule rule) {
        long now = clock.millis();
        Bucket bucket = buckets.computeIfAbsent(key,
            k -> new Bucket(rule.getLimit(), refillPerMilli(rule), now));
        return bucket.tryConsume(now);
    }

    private static double refillPerMilli(Rule rule) {
        return (double) rule.getLimit() / rule.getWindow().toMillis();
    }

    static final class Bucket {
        private final long capacity;
        private final double refillPerMilli;
        private double tokens;
        private long lastRefillMillis;

        Bucket(long capacity, double refillPerMilli, long now) {
            this.capacity = capacity;
            this.refillPerMilli = refillPerMilli;
            this.tokens = capacity;
            this.lastRefillMillis = now;
        }

        synchronized Decision tryConsume(long now) {
            refill(now);
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return Decision.allowed((long) tokens);
            }
            double missing = 1.0 - tokens;
            long waitMillis = (long) Math.ceil(missing / refillPerMilli);
            return Decision.rejected(Math.max(1, waitMillis / 1000));
        }

        // Lazy refill: tokens are topped up only when a request arrives,
        // so idle keys cost nothing and no background timer is needed.
        private void refill(long now) {
            long elapsed = now - lastRefillMillis;
            if (elapsed <= 0) {
                return;
            }
            tokens = Math.min(capacity, tokens + elapsed * refillPerMilli);
            lastRefillMillis = now;
        }
    }
}

final class Decision {
    private final boolean allowed;
    private final long remaining;
    private final long retryAfterSeconds;

    private Decision(boolean allowed, long remaining, long retryAfterSeconds) {
        this.allowed = allowed;
        this.remaining = remaining;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    static Decision allowed(long remaining) {
        return new Decision(true, remaining, 0);
    }

    static Decision rejected(long retryAfterSeconds) {
        return new Decision(false, 0, retryAfterSeconds);
    }

    public boolean isAllowed() { return allowed; }
    public long getRemaining() { return remaining; }
    public long getRetryAfterSeconds() { return retryAfterSeconds; }
}`,
    },
    patterns: [
      { name: "Strategy", where: "RateLimitAlgorithm has token bucket and sliding window counter implementations, chosen per Rule." },
      { name: "Factory", where: "AlgorithmFactory maps the AlgorithmType in a rule to the matching strategy instance." },
      { name: "Chain of Responsibility", where: "RateLimitFilter is one link in the gateway filter chain and either forwards the request or short-circuits with 429." },
      { name: "Static factory methods", where: "Decision.allowed and Decision.rejected keep the result immutable and self-describing." },
    ],
  },

  pastebin: {
    classDiagram: `classDiagram
  class PasteController {
    -PasteService pasteService
    +create(CreatePasteRequest req) ResponseEntity
    +get(String key) ResponseEntity
  }
  class PasteService {
    -KeyGenerator keyGen
    -BlobStore blobStore
    -PasteMetadataRepository metaRepo
    -CdnUrlBuilder cdn
    +create(String content, Duration ttl, Visibility v, long ownerId) PasteMetadata
    +get(String key) PasteView
  }
  class KeyGenerator {
    <<interface>>
    +nextKey() String
  }
  class BlobStore {
    <<interface>>
    +put(String path, String content, Instant expiresAt) void
    +get(String path) String
  }
  class S3BlobStore {
    -S3Client s3
    -String bucket
    +put(String path, String content, Instant expiresAt) void
    +get(String path) String
  }
  class PasteMetadata {
    -String key
    -String s3Path
    -long ownerId
    -long sizeBytes
    -Instant createdAt
    -Instant expiresAt
    -Visibility visibility
  }
  class PasteMetadataRepository {
    <<interface>>
    +save(PasteMetadata m) void
    +findByKey(String key) Optional~PasteMetadata~
    +deleteExpiredBefore(Instant t) int
  }
  class Visibility {
    <<enumeration>>
    PUBLIC
    UNLISTED
    PRIVATE
  }
  class ExpiryCleanupJob {
    -PasteMetadataRepository metaRepo
    +run() void
  }
  PasteController --> PasteService
  PasteService --> KeyGenerator
  PasteService --> BlobStore
  PasteService --> PasteMetadataRepository
  BlobStore <|.. S3BlobStore
  PasteMetadataRepository "1" --> "many" PasteMetadata
  PasteMetadata --> Visibility
  ExpiryCleanupJob --> PasteMetadataRepository`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant S as PasteService
  participant K as KeyGenerator
  participant OBJ as Object Storage
  participant M as Metadata DB
  participant CDN as CDN
  C->>S: POST /api/v1/pastes content, expiry
  S->>K: nextKey()
  K-->>S: Xb81Lm2
  S->>OBJ: PUT pastes/Xb81Lm2
  OBJ-->>S: stored
  S->>M: save(metadata with s3_path)
  S-->>C: 201 Created key and url
  C->>S: GET /api/v1/pastes/Xb81Lm2
  S->>M: findByKey(Xb81Lm2)
  alt expired or not found
    M-->>S: empty
    S-->>C: 404 Not Found
  else found
    M-->>S: metadata
    S-->>C: meta plus CDN content URL
    C->>CDN: GET content URL
    alt edge hit
      CDN-->>C: cached body
    else edge miss
      CDN->>OBJ: GET pastes/Xb81Lm2
      OBJ-->>CDN: body
      CDN-->>C: body
    end
  end`,
    sequenceCaption: "Creating a paste with the body in object storage and metadata in the database, then reading it back through the CDN.",
    code: {
      lang: "java",
      caption: "PasteService writes the blob before the metadata row, so a reader can never find a pointer to a body that does not exist.",
      code: `import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

public class PasteService {

    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Duration DEFAULT_TTL = Duration.ofDays(30);

    private final KeyGenerator keyGen;
    private final BlobStore blobStore;
    private final PasteMetadataRepository metaRepo;
    private final CdnUrlBuilder cdn;
    private final Clock clock;

    public PasteService(KeyGenerator keyGen, BlobStore blobStore,
                        PasteMetadataRepository metaRepo, CdnUrlBuilder cdn, Clock clock) {
        this.keyGen = keyGen;
        this.blobStore = blobStore;
        this.metaRepo = metaRepo;
        this.cdn = cdn;
        this.clock = clock;
    }

    public PasteMetadata create(String content, Duration ttl, Visibility visibility, long ownerId) {
        long size = content.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if (size > MAX_BYTES) {
            throw new PasteTooLargeException(size);
        }
        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl != null ? ttl : DEFAULT_TTL);
        String key = keyGen.nextKey();
        String path = "pastes/" + key;

        // The expiry is passed down so the bucket lifecycle rule can delete the
        // body on its own; the cleanup job only has to remove metadata rows.
        blobStore.put(path, content, expiresAt);

        PasteMetadata meta = PasteMetadata.builder()
            .key(key)
            .s3Path(path)
            .ownerId(ownerId)
            .sizeBytes(size)
            .createdAt(now)
            .expiresAt(expiresAt)
            .visibility(visibility != null ? visibility : Visibility.UNLISTED)
            .build();
        metaRepo.save(meta);
        return meta;
    }

    public Optional<PasteView> get(String key, long viewerId) {
        Optional<PasteMetadata> found = metaRepo.findByKey(key);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        PasteMetadata meta = found.get();
        if (meta.getExpiresAt().isBefore(clock.instant())) {
            return Optional.empty();
        }
        if (meta.getVisibility() == Visibility.PRIVATE && meta.getOwnerId() != viewerId) {
            return Optional.empty();
        }
        String contentUrl = meta.getVisibility() == Visibility.PRIVATE
            ? cdn.signedUrl(meta.getS3Path(), Duration.ofMinutes(5))
            : cdn.publicUrl(meta.getS3Path());
        return Optional.of(new PasteView(meta, contentUrl));
    }
}`,
    },
    patterns: [
      { name: "Builder", where: "PasteMetadata.builder() assembles a row with several optional fields (expiry, visibility) without a long constructor." },
      { name: "Adapter", where: "S3BlobStore adapts the AWS SDK to the small BlobStore interface, so tests can use an in-memory store." },
      { name: "Repository", where: "PasteMetadataRepository isolates the metadata database from the service logic." },
      { name: "Strategy (reused)", where: "The same KeyGenerator interface from the URL shortener supplies base62 keys." },
    ],
  },

  "unique-id-generator": {
    classDiagram: `classDiagram
  class IdGenerator {
    <<interface>>
    +nextId() long
  }
  class SnowflakeIdGenerator {
    -long epochMillis
    -long machineId
    -long sequence
    -long lastTimestamp
    -TimeSource clock
    +nextId() long
    -waitNextMillis(long last) long
  }
  class MachineIdProvider {
    <<interface>>
    +acquire() long
    +release() void
  }
  class ZooKeeperMachineIdProvider {
    -CuratorFramework zk
    -String basePath
    +acquire() long
    +release() void
  }
  class TimeSource {
    <<interface>>
    +currentMillis() long
  }
  class SystemTimeSource {
    +currentMillis() long
  }
  class SnowflakeId {
    -long timestamp
    -long machineId
    -long sequence
    +decode(long id, long epoch)$ SnowflakeId
  }
  class ClockMovedBackwardsException {
    -long driftMillis
  }
  class IdGeneratorFactory {
    +create(MachineIdProvider p, TimeSource t)$ IdGenerator
  }
  IdGenerator <|.. SnowflakeIdGenerator
  MachineIdProvider <|.. ZooKeeperMachineIdProvider
  TimeSource <|.. SystemTimeSource
  SnowflakeIdGenerator --> TimeSource
  IdGeneratorFactory ..> MachineIdProvider : asks once
  IdGeneratorFactory ..> SnowflakeIdGenerator : creates
  SnowflakeIdGenerator ..> ClockMovedBackwardsException : throws
  SnowflakeIdGenerator ..> SnowflakeId : layout`,
    sequenceDiagram: `sequenceDiagram
  participant App as Order Service
  participant F as IdGeneratorFactory
  participant MP as ZooKeeperMachineIdProvider
  participant ZK as ZooKeeper
  participant G as SnowflakeIdGenerator
  participant T as TimeSource
  App->>F: create at startup
  F->>MP: acquire()
  MP->>ZK: create ephemeral sequential node
  ZK-->>MP: node 0000000017
  MP-->>F: machineId 17
  F-->>App: generator for machine 17
  App->>G: nextId()
  G->>T: currentMillis()
  T-->>G: now
  alt now greater than lastTimestamp
    G->>G: sequence = 0
  else same millisecond
    G->>G: sequence + 1, wait next ms on overflow
  else clock moved backwards
    G->>T: poll until caught up or fail
  end
  G-->>App: 64-bit id`,
    sequenceCaption: "A node obtains its machine id from ZooKeeper once at startup, then generates IDs locally with clock-skew handling.",
    code: {
      lang: "java",
      caption: "A Snowflake generator with a 41-bit timestamp, 10-bit machine id and 12-bit sequence, guarding against the clock moving backwards.",
      code: `public final class SnowflakeIdGenerator implements IdGenerator {

    private static final int MACHINE_BITS = 10;
    private static final int SEQUENCE_BITS = 12;

    private static final long MAX_MACHINE_ID = (1L << MACHINE_BITS) - 1;
    private static final long SEQUENCE_MASK = (1L << SEQUENCE_BITS) - 1;

    private static final int MACHINE_SHIFT = SEQUENCE_BITS;
    private static final int TIMESTAMP_SHIFT = SEQUENCE_BITS + MACHINE_BITS;

    // Small backwards jumps (NTP slew) are waited out; larger ones are refused.
    private static final long MAX_TOLERATED_DRIFT_MS = 5;

    private final long epochMillis;
    private final long machineId;
    private final TimeSource clock;

    private long lastTimestamp = -1L;
    private long sequence = 0L;

    public SnowflakeIdGenerator(long epochMillis, long machineId, TimeSource clock) {
        if (machineId < 0 || machineId > MAX_MACHINE_ID) {
            throw new IllegalArgumentException("machineId must be in 0.." + MAX_MACHINE_ID);
        }
        this.epochMillis = epochMillis;
        this.machineId = machineId;
        this.clock = clock;
    }

    @Override
    public synchronized long nextId() {
        long now = clock.currentMillis();

        if (now < lastTimestamp) {
            long drift = lastTimestamp - now;
            if (drift > MAX_TOLERATED_DRIFT_MS) {
                throw new ClockMovedBackwardsException(drift);
            }
            now = waitUntilAfter(lastTimestamp - 1);
        }

        if (now == lastTimestamp) {
            sequence = (sequence + 1) & SEQUENCE_MASK;
            if (sequence == 0) {
                now = waitUntilAfter(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = now;
        return ((now - epochMillis) << TIMESTAMP_SHIFT)
            | (machineId << MACHINE_SHIFT)
            | sequence;
    }

    private long waitUntilAfter(long timestamp) {
        long now = clock.currentMillis();
        while (now <= timestamp) {
            Thread.onSpinWait();
            now = clock.currentMillis();
        }
        return now;
    }

    public static long timestampOf(long id, long epochMillis) {
        return (id >>> TIMESTAMP_SHIFT) + epochMillis;
    }

    public static long machineIdOf(long id) {
        return (id >>> MACHINE_SHIFT) & MAX_MACHINE_ID;
    }

    public static long sequenceOf(long id) {
        return id & SEQUENCE_MASK;
    }
}

class ClockMovedBackwardsException extends RuntimeException {
    private final long driftMillis;

    ClockMovedBackwardsException(long driftMillis) {
        super("Clock moved backwards by " + driftMillis + " ms, refusing to issue IDs");
        this.driftMillis = driftMillis;
    }

    public long getDriftMillis() {
        return driftMillis;
    }
}`,
    },
    patterns: [
      { name: "Singleton (per process)", where: "One SnowflakeIdGenerator per machine id; two instances sharing an id in one JVM would collide, so it is created once and injected." },
      { name: "Factory", where: "IdGeneratorFactory acquires the machine id from ZooKeeper and wires the generator, hiding startup coordination from callers." },
      { name: "Dependency injection of time", where: "TimeSource is an interface so tests can simulate same-millisecond bursts and the clock moving backwards." },
      { name: "Strategy", where: "IdGenerator lets a service swap Snowflake for UUID v4 where coordination is not wanted." },
    ],
  },

  "web-crawler": {
    classDiagram: `classDiagram
  class CrawlerWorker {
    -UrlFrontier frontier
    -RobotsCache robots
    -PageFetcher fetcher
    -ContentProcessor processor
    +runLoop() void
  }
  class UrlFrontier {
    -List~PriorityQueue~ frontQueues
    -Map~String,HostQueue~ backQueues
    -DelayQueue readyHosts
    +enqueue(CrawlUrl url) void
    +next() CrawlUrl
    +release(String host, long delayMs) void
  }
  class HostQueue {
    -String host
    -Deque~CrawlUrl~ urls
    -long nextAllowedAt
  }
  class CrawlUrl {
    -String url
    -String host
    -int depth
    -int priority
  }
  class RobotsCache {
    +isAllowed(CrawlUrl url) boolean
    +crawlDelayMs(String host) long
  }
  class PageFetcher {
    <<interface>>
    +fetch(CrawlUrl url) FetchResult
  }
  class HttpPageFetcher {
    -HttpClient client
    -DnsCache dns
    +fetch(CrawlUrl url) FetchResult
  }
  class ContentProcessor {
    -LinkExtractor extractor
    -SeenUrlFilter seen
    -ContentDeduper dedup
    -ContentStore store
    +process(FetchResult page) void
  }
  class SeenUrlFilter {
    -BloomFilter bloom
    -KeyValueStore confirmed
    +markIfNew(String url) boolean
  }
  class ContentDeduper {
    +isDuplicate(String body) boolean
  }
  CrawlerWorker --> UrlFrontier
  CrawlerWorker --> RobotsCache
  CrawlerWorker --> PageFetcher
  CrawlerWorker --> ContentProcessor
  UrlFrontier "1" *-- "many" HostQueue
  HostQueue "1" o-- "many" CrawlUrl
  PageFetcher <|.. HttpPageFetcher
  ContentProcessor --> SeenUrlFilter
  ContentProcessor --> ContentDeduper
  ContentProcessor ..> UrlFrontier : enqueues new links`,
    sequenceDiagram: `sequenceDiagram
  participant W as CrawlerWorker
  participant FR as UrlFrontier
  participant RB as RobotsCache
  participant HF as HttpPageFetcher
  participant P as ContentProcessor
  participant SU as SeenUrlFilter
  participant CS as Content Store
  W->>FR: next()
  FR-->>W: CrawlUrl from a ready host queue
  W->>RB: isAllowed(url)
  alt disallowed by robots.txt
    RB-->>W: false
    W->>FR: release(host, crawlDelay)
  else allowed
    RB-->>W: true
    W->>HF: fetch(url)
    HF-->>W: FetchResult 200
    W->>FR: release(host, crawlDelay)
    W->>P: process(page)
    alt duplicate content hash
      P-->>W: skipped
    else new content
      P->>CS: store(page)
      loop each extracted link
        P->>SU: markIfNew(link)
        SU-->>P: true if never seen
        P->>FR: enqueue(link)
      end
    end
  end`,
    sequenceCaption: "One crawl cycle: take a polite URL from the frontier, check robots.txt, fetch, dedup content and enqueue unseen links.",
    code: {
      lang: "java",
      caption: "The URL frontier: front queues order by priority, per-host back queues plus a delay queue enforce politeness.",
      code: `import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.concurrent.DelayQueue;
import java.util.concurrent.Delayed;
import java.util.concurrent.TimeUnit;

public class UrlFrontier {

    private static final int MAX_DEPTH = 15;
    private static final int MAX_URLS_PER_HOST = 50_000;

    private final PriorityQueue<CrawlUrl> front =
        new PriorityQueue<>((a, b) -> Integer.compare(b.getPriority(), a.getPriority()));
    private final Map<String, Deque<CrawlUrl>> backQueues = new HashMap<>();
    private final Map<String, Integer> enqueuedPerHost = new HashMap<>();
    private final DelayQueue<HostSlot> readyHosts = new DelayQueue<>();

    public synchronized void enqueue(CrawlUrl url) {
        // Depth and per-host caps are the defence against crawler traps.
        if (url.getDepth() > MAX_DEPTH) return;
        int count = enqueuedPerHost.merge(url.getHost(), 1, Integer::sum);
        if (count > MAX_URLS_PER_HOST) return;
        front.add(url);
        drainFrontIntoBackQueues();
    }

    public CrawlUrl next() throws InterruptedException {
        while (true) {
            HostSlot slot = readyHosts.take();
            synchronized (this) {
                Deque<CrawlUrl> queue = backQueues.get(slot.host);
                if (queue != null && !queue.isEmpty()) {
                    // The host is now leased to this worker until release() is called.
                    return queue.pollFirst();
                }
                backQueues.remove(slot.host);
            }
        }
    }

    public synchronized void release(String host, long crawlDelayMs) {
        Deque<CrawlUrl> queue = backQueues.get(host);
        if (queue != null && !queue.isEmpty()) {
            readyHosts.put(new HostSlot(host, System.currentTimeMillis() + crawlDelayMs));
        } else {
            backQueues.remove(host);
        }
    }

    private void drainFrontIntoBackQueues() {
        while (!front.isEmpty()) {
            CrawlUrl url = front.poll();
            Deque<CrawlUrl> queue = backQueues.get(url.getHost());
            if (queue == null) {
                queue = new ArrayDeque<>();
                backQueues.put(url.getHost(), queue);
                readyHosts.put(new HostSlot(url.getHost(), System.currentTimeMillis()));
            }
            queue.addLast(url);
        }
    }

    private static final class HostSlot implements Delayed {
        final String host;
        final long readyAtMillis;

        HostSlot(String host, long readyAtMillis) {
            this.host = host;
            this.readyAtMillis = readyAtMillis;
        }

        @Override
        public long getDelay(TimeUnit unit) {
            return unit.convert(readyAtMillis - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
        }

        @Override
        public int compareTo(Delayed other) {
            return Long.compare(readyAtMillis, ((HostSlot) other).readyAtMillis);
        }
    }
}`,
    },
    patterns: [
      { name: "Producer-consumer", where: "ContentProcessor produces URLs into the UrlFrontier and a pool of CrawlerWorker threads consumes them." },
      { name: "Strategy", where: "PageFetcher is an interface so an HTTP fetcher and a headless-browser fetcher for JavaScript pages can be swapped." },
      { name: "Proxy / cache", where: "RobotsCache and the DNS cache sit in front of slow network lookups and answer repeat questions per host." },
      { name: "Probabilistic filter in front of a store", where: "SeenUrlFilter checks the Bloom filter first and only consults the persistent set when the filter says maybe." },
    ],
  },

  "notification-system": {
    classDiagram: `classDiagram
  class NotificationController {
    -NotificationService service
    +notify(NotifyRequest req) ResponseEntity
  }
  class NotificationService {
    -PreferenceService prefs
    -DedupStore dedup
    -TemplateRenderer renderer
    -QueuePublisher publisher
    +accept(NotifyRequest req) void
  }
  class Notification {
    -String dedupKey
    -long userId
    -Channel channel
    -String renderedBody
    -int attempt
  }
  class Channel {
    <<enumeration>>
    PUSH
    SMS
    EMAIL
  }
  class PreferenceService {
    +isAllowed(long userId, Channel c, Instant now) boolean
  }
  class TemplateRenderer {
    +render(String templateId, Locale locale, Map data) String
  }
  class QueuePublisher {
    +publish(String topic, Notification n) void
  }
  class ChannelWorker {
    -ChannelSender sender
    -DeliveryLog log
    -DedupStore dedup
    +onMessage(Notification n) void
  }
  class ChannelSender {
    <<interface>>
    +channel() Channel
    +send(Notification n) SendResult
  }
  class FcmPushSender {
    +send(Notification n) SendResult
  }
  class TwilioSmsSender {
    +send(Notification n) SendResult
  }
  class SesEmailSender {
    +send(Notification n) SendResult
  }
  NotificationController --> NotificationService
  NotificationService --> PreferenceService
  NotificationService --> TemplateRenderer
  NotificationService --> QueuePublisher
  NotificationService ..> Notification : creates per channel
  Notification --> Channel
  ChannelWorker "1" --> "1" ChannelSender
  ChannelSender <|.. FcmPushSender
  ChannelSender <|.. TwilioSmsSender
  ChannelSender <|.. SesEmailSender`,
    sequenceDiagram: `sequenceDiagram
  participant P as Order Service
  participant NS as NotificationService
  participant PR as PreferenceService
  participant Q as SMS Queue
  participant W as SMS ChannelWorker
  participant TW as Twilio
  participant DLQ as Dead-letter Queue
  P->>NS: POST /notify user 42, sms, otp template
  NS->>PR: isAllowed(42, SMS, now)
  alt opted out or quiet hours
    PR-->>NS: false
    NS-->>P: 202 Accepted, dropped by preference
  else allowed
    PR-->>NS: true
    NS->>NS: render template, build dedupKey
    NS->>Q: publish(notification)
    NS-->>P: 202 Accepted
    Q->>W: deliver message
    W->>W: check dedup store
    W->>TW: send SMS
    alt provider success
      TW-->>W: 200 queued
      W->>W: log SENT, mark dedupKey seen
      W-->>Q: ack
    else failure after max attempts
      TW-->>W: 503
      W->>DLQ: park with error
      W-->>Q: ack
    end
  end`,
    sequenceCaption: "An SMS notification passing preference checks, the channel queue and the worker's retry, dedup and dead-letter handling.",
    code: {
      lang: "java",
      caption: "A channel worker that makes at-least-once delivery safe: idempotent by dedup key, exponential backoff, then dead-letter after N attempts.",
      code: `import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

public class ChannelWorker {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration BASE_DELAY = Duration.ofSeconds(2);
    private static final Duration MAX_DELAY = Duration.ofMinutes(10);

    private final ChannelSender sender;
    private final DedupStore dedup;
    private final DeliveryLog log;
    private final QueuePublisher publisher;
    private final String retryTopic;
    private final String deadLetterTopic;

    public ChannelWorker(ChannelSender sender, DedupStore dedup, DeliveryLog log,
                         QueuePublisher publisher, String retryTopic, String deadLetterTopic) {
        this.sender = sender;
        this.dedup = dedup;
        this.log = log;
        this.publisher = publisher;
        this.retryTopic = retryTopic;
        this.deadLetterTopic = deadLetterTopic;
    }

    public void onMessage(Notification n) {
        if (dedup.alreadySent(n.getDedupKey())) {
            log.record(n, DeliveryStatus.DUPLICATE_SKIPPED, null);
            return;
        }

        SendResult result;
        try {
            result = sender.send(n);
        } catch (RuntimeException e) {
            result = SendResult.retryable(e.getMessage());
        }

        if (result.isSuccess()) {
            dedup.markSent(n.getDedupKey(), Duration.ofDays(1));
            log.record(n, DeliveryStatus.SENT, result.getProviderMessageId());
        } else if (result.isPermanentFailure()) {
            // A bad phone number will never succeed, so retrying only wastes quota.
            log.record(n, DeliveryStatus.FAILED, result.getError());
            publisher.publish(deadLetterTopic, n);
        } else {
            scheduleRetry(n, result.getError());
        }
    }

    private void scheduleRetry(Notification n, String error) {
        int nextAttempt = n.getAttempt() + 1;
        if (nextAttempt >= MAX_ATTEMPTS) {
            log.record(n, DeliveryStatus.FAILED, error);
            publisher.publish(deadLetterTopic, n);
            return;
        }
        Notification retry = n.withAttempt(nextAttempt);
        publisher.publishDelayed(retryTopic, retry, backoff(nextAttempt));
        log.record(n, DeliveryStatus.RETRY_SCHEDULED, error);
    }

    // Full jitter spreads retries out so a provider outage does not end in a thundering herd.
    static Duration backoff(int attempt) {
        long exp = BASE_DELAY.toMillis() * (1L << Math.min(attempt, 20));
        long capped = Math.min(exp, MAX_DELAY.toMillis());
        return Duration.ofMillis(ThreadLocalRandom.current().nextLong(capped + 1));
    }
}`,
    },
    patterns: [
      { name: "Adapter", where: "FcmPushSender, TwilioSmsSender and SesEmailSender wrap each provider SDK behind the ChannelSender interface, enabling failover." },
      { name: "Strategy", where: "Each ChannelWorker is configured with one ChannelSender, so the retry and dedup logic is written once for all channels." },
      { name: "Observer / pub-sub", where: "Producers publish to channel queues and workers subscribe independently, decoupling services from providers." },
      { name: "Idempotent consumer", where: "ChannelWorker checks the DedupStore by dedupKey before sending, which makes at-least-once delivery safe." },
    ],
  },

  "news-feed": {
    classDiagram: `classDiagram
  class PostController {
    -PostService postService
    -FeedService feedService
    +createPost(CreatePostRequest req) ResponseEntity
    +getFeed(long userId, String cursor) FeedPage
  }
  class PostService {
    -PostRepository posts
    -FanoutPublisher publisher
    +create(long authorId, String content) Post
  }
  class Post {
    -long postId
    -long authorId
    -String content
    -Instant createdAt
  }
  class PostRepository {
    <<interface>>
    +save(Post p) void
    +findByIds(List~Long~ ids) List~Post~
    +recentByAuthor(long authorId, int limit) List~Post~
  }
  class FanoutWorker {
    -GraphService graph
    -FeedCache feedCache
    -long celebrityThreshold
    +onPostCreated(PostCreatedEvent e) void
  }
  class GraphService {
    +followerCount(long userId) long
    +followers(long userId, String cursor, int size) Page
    +followedCelebrities(long userId) List~Long~
  }
  class FeedCache {
    +push(long userId, long postId) void
    +range(long userId, int offset, int size) List~Long~
  }
  class FeedService {
    -FeedCache feedCache
    -PostRepository posts
    -GraphService graph
    -FeedRanker ranker
    +getFeed(long userId, String cursor) FeedPage
  }
  class FeedRanker {
    <<interface>>
    +rank(long viewerId, List~Post~ candidates) List~Post~
  }
  class ChronologicalRanker {
    +rank(long viewerId, List~Post~ candidates) List~Post~
  }
  PostController --> PostService
  PostController --> FeedService
  PostService --> PostRepository
  PostRepository "1" --> "many" Post
  FanoutWorker --> GraphService
  FanoutWorker --> FeedCache
  FeedService --> FeedCache
  FeedService --> PostRepository
  FeedService --> FeedRanker
  FeedRanker <|.. ChronologicalRanker`,
    sequenceDiagram: `sequenceDiagram
  participant A as Author
  participant PS as PostService
  participant DB as Post Store
  participant K as Kafka
  participant FW as FanoutWorker
  participant G as GraphService
  participant FC as Feed Cache
  A->>PS: POST /posts content
  PS->>DB: save(post)
  PS->>K: publish PostCreated
  PS-->>A: 201 post_id
  K->>FW: PostCreated
  FW->>G: followerCount(authorId)
  alt celebrity, above threshold
    G-->>FW: 30M
    FW->>FW: skip push, readers pull at read time
  else normal user
    G-->>FW: 350
    loop each page of followers
      FW->>G: followers(authorId, cursor)
      G-->>FW: follower ids
      FW->>FC: LPUSH and LTRIM each follower feed
    end
  end`,
    sequenceCaption: "Publishing a post and fanning it out asynchronously, pushing for normal authors and skipping push for celebrities.",
    code: {
      lang: "java",
      caption: "The hybrid fan-out worker pushes post ids into follower timelines, and the read side merges in celebrity posts pulled at request time.",
      code: `import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class FanoutWorker {

    private static final int PAGE_SIZE = 1_000;
    private static final int FEED_MAX_LENGTH = 500;

    private final GraphService graph;
    private final FeedCache feedCache;
    private final long celebrityThreshold;

    public FanoutWorker(GraphService graph, FeedCache feedCache, long celebrityThreshold) {
        this.graph = graph;
        this.feedCache = feedCache;
        this.celebrityThreshold = celebrityThreshold;
    }

    public void onPostCreated(PostCreatedEvent event) {
        long authorId = event.getAuthorId();
        if (graph.followerCount(authorId) >= celebrityThreshold) {
            return;
        }
        String cursor = null;
        do {
            Page<Long> page = graph.followers(authorId, cursor, PAGE_SIZE);
            for (long followerId : page.getItems()) {
                // Pushing the same id twice is harmless because the cache list is
                // deduplicated on read, so redelivered Kafka events need no extra guard.
                feedCache.pushAndTrim(followerId, event.getPostId(), FEED_MAX_LENGTH);
            }
            cursor = page.getNextCursor();
        } while (cursor != null);
        feedCache.pushAndTrim(authorId, event.getPostId(), FEED_MAX_LENGTH);
    }
}

class FeedService {

    private static final int CELEBRITY_POSTS_EACH = 20;

    private final FeedCache feedCache;
    private final PostRepository posts;
    private final GraphService graph;
    private final FeedRanker ranker;

    FeedService(FeedCache feedCache, PostRepository posts, GraphService graph, FeedRanker ranker) {
        this.feedCache = feedCache;
        this.posts = posts;
        this.graph = graph;
        this.ranker = ranker;
    }

    public List<Post> getFeed(long userId, int offset, int size) {
        List<Long> pushedIds = feedCache.range(userId, 0, offset + size * 2);
        List<Post> candidates = new ArrayList<>(posts.findByIds(pushedIds));

        for (long celebId : graph.followedCelebrities(userId)) {
            candidates.addAll(posts.recentByAuthor(celebId, CELEBRITY_POSTS_EACH));
        }

        Set<Long> seen = new HashSet<>();
        candidates.removeIf(p -> !seen.add(p.getPostId()));
        candidates.sort(Comparator.comparing(Post::getCreatedAt).reversed());

        List<Post> ranked = ranker.rank(userId, candidates);
        int from = Math.min(offset, ranked.size());
        int to = Math.min(offset + size, ranked.size());
        return ranked.subList(from, to);
    }
}`,
    },
    patterns: [
      { name: "Observer / event-driven", where: "PostService only publishes PostCreated; FanoutWorker reacts asynchronously so posting stays fast." },
      { name: "Strategy", where: "FeedRanker starts as ChronologicalRanker and can be replaced by an ML-scored ranker without changing FeedService." },
      { name: "Repository", where: "PostRepository hides Cassandra and exposes the two read shapes the feed needs: by ids and recent by author." },
      { name: "Hybrid push/pull", where: "FanoutWorker skips authors above celebrityThreshold and FeedService merges their posts in at read time." },
    ],
  },

  "chat-system": {
    classDiagram: `classDiagram
  class ChatWebSocketHandler {
    -ChatService chatService
    -ConnectionRegistry registry
    +onConnect(long userId, Session s) void
    +onFrame(long userId, ClientFrame f) void
    +onDisconnect(long userId) void
  }
  class ChatService {
    -MessageRepository messages
    -SequenceAllocator sequences
    -MessageRouter router
    -ConversationRepository conversations
    +send(long senderId, String convId, String body, String clientMsgId) Message
    +syncOnReconnect(long userId) void
    +acknowledge(long userId, String messageId, DeliveryStatus s) void
  }
  class Message {
    -String conversationId
    -long sequence
    -String messageId
    -String clientMsgId
    -long senderId
    -String body
    -Instant ts
  }
  class Conversation {
    -String conversationId
    -List~Long~ memberIds
    -boolean group
  }
  class DeliveryStatus {
    <<enumeration>>
    SENT
    DELIVERED
    READ
  }
  class MessageRepository {
    <<interface>>
    +append(Message m) boolean
    +after(String convId, long sequence) List~Message~
  }
  class SequenceAllocator {
    +next(String convId) long
  }
  class ConnectionRegistry {
    +register(long userId, String gatewayId) void
    +lookup(long userId) Optional~String~
    +remove(long userId) void
  }
  class MessageRouter {
    -ConnectionRegistry registry
    -GatewayClient gateways
    +deliver(long recipientId, Message m) boolean
  }
  class PresenceService {
    +heartbeat(long userId) void
    +lastSeen(long userId) Instant
  }
  ChatWebSocketHandler --> ChatService
  ChatWebSocketHandler --> ConnectionRegistry
  ChatWebSocketHandler --> PresenceService
  ChatService --> MessageRepository
  ChatService --> SequenceAllocator
  ChatService --> MessageRouter
  MessageRouter --> ConnectionRegistry
  Conversation "1" *-- "many" Message
  Message ..> DeliveryStatus`,
    sequenceDiagram: `sequenceDiagram
  participant A as User A
  participant GA as Gateway A
  participant CS as ChatService
  participant DB as Message Store
  participant REG as Conn Registry
  participant GB as Gateway B
  participant B as User B
  A->>GA: msg conv_7 body client_msg_id
  GA->>CS: send(A, conv_7, body)
  CS->>CS: allocate sequence 1042
  CS->>DB: append(message)
  CS-->>GA: ack SENT message_id
  GA-->>A: ack SENT
  CS->>REG: lookup(B)
  alt B online
    REG-->>CS: gateway B
    CS->>GB: push message
    GB->>B: message frame
    B-->>GB: ack DELIVERED
    GB->>CS: acknowledge(DELIVERED)
  else B offline
    REG-->>CS: empty
    CS->>CS: leave in store, send mobile push
    B->>GB: reconnect with last seen sequence
    GB->>REG: register(B, gateway B)
    GB->>CS: syncOnReconnect(B)
    CS->>DB: after(conv_7, last seen sequence)
    DB-->>CS: missed messages
    CS->>GB: push missed messages
    GB->>B: messages in sequence order
  end`,
    sequenceCaption: "Sending a message to a user who may be offline, with delivery on reconnect ordered by per-conversation sequence numbers.",
    code: {
      lang: "java",
      caption: "ChatService persists before routing, uses the client message id for idempotent retries and lets reconnecting clients catch up by sequence.",
      code: `import java.time.Clock;
import java.util.List;
import java.util.Map;

public class ChatService {

    private final MessageRepository messages;
    private final ConversationRepository conversations;
    private final SequenceAllocator sequences;
    private final MessageRouter router;
    private final IdGenerator ids;
    private final OfflinePushNotifier offlinePush;
    private final Clock clock;

    public ChatService(MessageRepository messages, ConversationRepository conversations,
                       SequenceAllocator sequences, MessageRouter router, IdGenerator ids,
                       OfflinePushNotifier offlinePush, Clock clock) {
        this.messages = messages;
        this.conversations = conversations;
        this.sequences = sequences;
        this.router = router;
        this.ids = ids;
        this.offlinePush = offlinePush;
        this.clock = clock;
    }

    public Message send(long senderId, String convId, String body, String clientMsgId) {
        Conversation conv = conversations.get(convId);
        if (!conv.getMemberIds().contains(senderId)) {
            throw new NotAMemberException(senderId, convId);
        }

        // A client that retries after a lost ack resends the same clientMsgId;
        // returning the stored copy stops the message appearing twice.
        Message existing = messages.findByClientMsgId(convId, senderId, clientMsgId);
        if (existing != null) {
            return existing;
        }

        Message msg = new Message(
            convId,
            sequences.next(convId),
            Long.toString(ids.nextId()),
            clientMsgId,
            senderId,
            body,
            clock.instant());
        messages.append(msg);

        for (long memberId : conv.getMemberIds()) {
            if (memberId == senderId) {
                continue;
            }
            boolean delivered = router.deliver(memberId, msg);
            if (!delivered) {
                offlinePush.notify(memberId, msg);
            }
        }
        return msg;
    }

    public void syncOnReconnect(long userId, Map<String, Long> lastSeenByConversation) {
        for (Map.Entry<String, Long> entry : lastSeenByConversation.entrySet()) {
            List<Message> missed = messages.after(entry.getKey(), entry.getValue());
            for (Message m : missed) {
                router.deliver(userId, m);
            }
        }
    }

    public void acknowledge(long userId, String convId, long upToSequence, DeliveryStatus status) {
        messages.updateReceipt(convId, userId, upToSequence, status);
        Conversation conv = conversations.get(convId);
        for (long memberId : conv.getMemberIds()) {
            if (memberId != userId) {
                router.deliverReceipt(memberId, convId, userId, upToSequence, status);
            }
        }
    }
}`,
    },
    patterns: [
      { name: "Mediator", where: "ChatService coordinates storage, sequencing and routing so gateways never talk to each other directly." },
      { name: "Registry", where: "ConnectionRegistry maps each user to the gateway holding their socket, so MessageRouter knows where to push." },
      { name: "Idempotent receiver", where: "send looks up clientMsgId first, so client retries after a lost ack do not create duplicates." },
      { name: "Repository", where: "MessageRepository hides the Cassandra layout partitioned by conversation_id and clustered by sequence." },
    ],
  },

  "photo-sharing": {
    classDiagram: `classDiagram
  class MediaController {
    -UploadService uploads
    -PostService posts
    +requestUploadUrl(long userId, String contentType) UploadTicket
    +createPost(long userId, String mediaId, String caption) Post
  }
  class UploadService {
    -StorageSigner signer
    -MediaRepository media
    +issueTicket(long userId, String contentType) UploadTicket
  }
  class StorageSigner {
    <<interface>>
    +presignPut(String objectKey, Duration ttl) URL
  }
  class S3StorageSigner {
    -S3Presigner presigner
    +presignPut(String objectKey, Duration ttl) URL
  }
  class MediaAsset {
    -String mediaId
    -long ownerId
    -String originalKey
    -String contentHash
    -MediaStatus status
    -Map~ImageSize,String~ variants
  }
  class MediaStatus {
    <<enumeration>>
    PENDING_UPLOAD
    PROCESSING
    READY
    FAILED
  }
  class MediaPipelineWorker {
    -ObjectStorage storage
    -ImageResizer resizer
    -MediaRepository media
    +onObjectCreated(ObjectCreatedEvent e) void
  }
  class ImageResizer {
    +resize(BufferedImage src, int maxEdge) BufferedImage
  }
  class PostService {
    -PostRepository posts
    -MediaRepository media
    -FanoutPublisher fanout
    +create(long userId, String mediaId, String caption) Post
  }
  class Post {
    -long postId
    -long userId
    -String caption
    -String mediaId
    -Instant createdAt
  }
  MediaController --> UploadService
  MediaController --> PostService
  UploadService --> StorageSigner
  StorageSigner <|.. S3StorageSigner
  MediaAsset --> MediaStatus
  MediaPipelineWorker --> ImageResizer
  MediaPipelineWorker ..> MediaAsset : updates
  PostService ..> Post : creates
  Post "many" --> "1" MediaAsset`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant APP as App Server
  participant OBJ as Object Storage
  participant Q as Upload Queue
  participant PIPE as MediaPipelineWorker
  participant DB as Metadata DB
  C->>APP: POST /media/upload-url
  APP->>DB: insert media PENDING_UPLOAD
  APP-->>C: presigned_url, media_id
  C->>OBJ: PUT original bytes
  OBJ->>Q: ObjectCreated event
  Q->>PIPE: ObjectCreated
  PIPE->>OBJ: GET original
  PIPE->>OBJ: PUT thumbnail, feed and full sizes
  PIPE->>DB: mark media READY with variant keys
  C->>APP: POST /posts media_id, caption
  APP->>DB: load media
  alt media READY
    APP->>DB: insert post
    APP-->>C: 201 post_id
  else still PROCESSING
    APP->>DB: insert post as pending publish
    APP-->>C: 202 post publishes when sizes are ready
  end`,
    sequenceCaption: "Uploading a photo directly to object storage with a pre-signed URL, resizing asynchronously, then creating the post.",
    code: {
      lang: "java",
      caption: "The media pipeline worker turns one uploaded original into the fixed set of sizes, keyed by content hash so the CDN can cache them forever.",
      code: `import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.Map;
import javax.imageio.ImageIO;

public class MediaPipelineWorker {

    public enum ImageSize {
        THUMBNAIL(150), FEED(1080), FULL(2048);

        final int maxEdge;

        ImageSize(int maxEdge) {
            this.maxEdge = maxEdge;
        }
    }

    private final ObjectStorage storage;
    private final ImageResizer resizer;
    private final MediaRepository media;

    public MediaPipelineWorker(ObjectStorage storage, ImageResizer resizer, MediaRepository media) {
        this.storage = storage;
        this.resizer = resizer;
        this.media = media;
    }

    public void onObjectCreated(ObjectCreatedEvent event) {
        MediaAsset asset = media.findByOriginalKey(event.getObjectKey());
        if (asset == null || asset.getStatus() == MediaStatus.READY) {
            // Storage events can arrive more than once; a READY asset is already done.
            return;
        }
        media.updateStatus(asset.getMediaId(), MediaStatus.PROCESSING);

        try {
            byte[] original = storage.get(event.getObjectKey());
            String hash = sha256(original);
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(original));
            if (source == null) {
                media.updateStatus(asset.getMediaId(), MediaStatus.FAILED);
                return;
            }

            Map<ImageSize, String> variants = new EnumMap<>(ImageSize.class);
            for (ImageSize size : ImageSize.values()) {
                BufferedImage resized = resizer.resize(source, size.maxEdge);
                String key = "media/" + hash + "/" + size.name().toLowerCase() + ".jpg";
                storage.put(key, toJpeg(resized), "image/jpeg", "public, max-age=31536000, immutable");
                variants.put(size, key);
            }

            media.markReady(asset.getMediaId(), hash, variants);
        } catch (IOException e) {
            // Leave it PROCESSING and rethrow so the queue redelivers with backoff.
            throw new RetryableProcessingException(asset.getMediaId(), e);
        }
    }

    private static byte[] toJpeg(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", out);
        return out.toByteArray();
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}`,
    },
    patterns: [
      { name: "Adapter", where: "S3StorageSigner wraps the AWS presigner behind StorageSigner, so the app never handles the upload bytes or SDK details." },
      { name: "State machine", where: "MediaStatus moves PENDING_UPLOAD to PROCESSING to READY or FAILED, and PostService only publishes READY media." },
      { name: "Event-driven worker", where: "MediaPipelineWorker reacts to ObjectCreated events from storage, keeping resizing off the upload request path." },
      { name: "Content addressing", where: "Variant keys include the SHA-256 of the original, making URLs immutable and safe to cache at the CDN for a year." },
    ],
  },

  "search-autocomplete": {
    classDiagram: `classDiagram
  class SuggestController {
    -SuggestService service
    +suggest(String q, int limit) SuggestResponse
  }
  class SuggestService {
    -SuggestionCache cache
    -ShardRouter router
    +suggest(String prefix, int k) List~Suggestion~
  }
  class SuggestionCache {
    +get(String prefix) List~Suggestion~
    +put(String prefix, List~Suggestion~ s, Duration ttl) void
  }
  class ShardRouter {
    -Map~String,TrieShard~ shardsByLetters
    +shardFor(String prefix) TrieShard
  }
  class TrieShard {
    -AtomicReference~Trie~ current
    +topK(String prefix, int k) List~Suggestion~
    +swap(Trie fresh) void
  }
  class Trie {
    -TrieNode root
    -int k
    +insert(String query, long weight) void
    +finalizeTopK() void
    +topK(String prefix) List~Suggestion~
  }
  class TrieNode {
    -Map~Character,TrieNode~ children
    -long terminalWeight
    -List~Suggestion~ topK
  }
  class Suggestion {
    -String text
    -long score
  }
  class TrieBuilder {
    -QueryLogAggregator aggregator
    +build(int k, Instant since) Trie
  }
  class QueryLogAggregator {
    +weightedCounts(Instant since) Map~String,Long~
  }
  SuggestController --> SuggestService
  SuggestService --> SuggestionCache
  SuggestService --> ShardRouter
  ShardRouter "1" --> "many" TrieShard
  TrieShard --> Trie
  Trie "1" *-- "many" TrieNode
  TrieNode "1" o-- "k" Suggestion
  TrieBuilder --> QueryLogAggregator
  TrieBuilder ..> Trie : builds offline`,
    sequenceDiagram: `sequenceDiagram
  participant U as User
  participant C as Browser Client
  participant CACHE as Redis or CDN
  participant S as SuggestService
  participant R as ShardRouter
  participant T as TrieShard
  U->>C: types l, o, n
  C->>C: debounce 100ms, cancel stale request
  C->>CACHE: GET /suggest?q=lon
  alt cached prefix
    CACHE-->>C: london, long, longitude
  else miss
    CACHE->>S: suggest(lon, 5)
    S->>R: shardFor(lon)
    R-->>S: shard l
    S->>T: topK(lon, 5)
    T-->>S: precomputed top-k at node lon
    S-->>CACHE: suggestions, cache with short TTL
    CACHE-->>C: london, long, longitude
  end
  C-->>U: render dropdown`,
    sequenceCaption: "A debounced keystroke resolved from the prefix cache, or on a miss from the sharded in-memory trie's precomputed top-k.",
    code: {
      lang: "java",
      caption: "A trie that stores the top-k completions at every node, computed once after the offline build so each lookup is O(prefix length).",
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public class Trie {

    private static final Comparator<Suggestion> BY_SCORE =
        Comparator.comparingLong(Suggestion::score).reversed().thenComparing(Suggestion::text);

    private final TrieNode root = new TrieNode();
    private final int k;

    public Trie(int k) {
        this.k = k;
    }

    public void insert(String query, long weight) {
        TrieNode node = root;
        for (char c : query.toLowerCase().toCharArray()) {
            node = node.children.computeIfAbsent(c, ch -> new TrieNode());
        }
        node.terminalWeight += weight;
    }

    // Called once by TrieBuilder after all inserts; the serving copy is read-only
    // afterwards, which is why lookups need no locking.
    public void finalizeTopK() {
        collect(root, new StringBuilder());
    }

    private List<Suggestion> collect(TrieNode node, StringBuilder path) {
        PriorityQueue<Suggestion> heap = new PriorityQueue<>(BY_SCORE.reversed());
        if (node.terminalWeight > 0) {
            offer(heap, new Suggestion(path.toString(), node.terminalWeight));
        }
        for (Map.Entry<Character, TrieNode> e : node.children.entrySet()) {
            path.append(e.getKey());
            for (Suggestion s : collect(e.getValue(), path)) {
                offer(heap, s);
            }
            path.deleteCharAt(path.length() - 1);
        }
        List<Suggestion> best = new ArrayList<>(heap);
        best.sort(BY_SCORE);
        node.topK = Collections.unmodifiableList(best);
        return node.topK;
    }

    private void offer(PriorityQueue<Suggestion> heap, Suggestion s) {
        heap.offer(s);
        if (heap.size() > k) {
            heap.poll();
        }
    }

    public List<Suggestion> topK(String prefix) {
        TrieNode node = root;
        for (char c : prefix.toLowerCase().toCharArray()) {
            node = node.children.get(c);
            if (node == null) {
                return List.of();
            }
        }
        return node.topK;
    }

    static final class TrieNode {
        final Map<Character, TrieNode> children = new HashMap<>();
        long terminalWeight;
        List<Suggestion> topK = List.of();
    }

    public record Suggestion(String text, long score) { }
}`,
    },
    patterns: [
      { name: "Builder", where: "TrieBuilder aggregates query logs offline and produces a finished, read-only Trie in one step." },
      { name: "Copy-on-write swap", where: "TrieShard holds the trie in an AtomicReference and swaps in a freshly built one, so readers never see a half-built index." },
      { name: "Cache-aside", where: "SuggestService checks SuggestionCache for hot prefixes before touching the trie shard." },
      { name: "Router / partitioning", where: "ShardRouter maps a prefix's first letters to the TrieShard that owns it, with hot shards replicated." },
    ],
  },
};
