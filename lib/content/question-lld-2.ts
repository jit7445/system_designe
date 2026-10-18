import type { QuestionLLD } from "../types";

export const QUESTION_LLD_2: Record<string, QuestionLLD> = {
  "nearby-places": {
    classDiagram: `classDiagram
  class SearchController {
    -SearchService service
    +search(double lat, double lng, double radiusKm, String category) List~PlaceView~
  }
  class SearchService {
    -GeoIndex index
    -PlaceRepository places
    -SearchCache cache
    -RankingStrategy ranker
    +findNearby(SearchQuery query) List~Place~
  }
  class SearchQuery {
    +double lat
    +double lng
    +double radiusKm
    +String category
    +cacheKey() String
  }
  class GeoIndex {
    <<interface>>
    +candidateIds(double lat, double lng, double radiusKm) List~Long~
  }
  class GeohashIndex {
    -Map~String,List~Long~~ buckets
    +candidateIds(double lat, double lng, double radiusKm) List~Long~
    +rebuild(List~Place~ all) void
  }
  class QuadTreeIndex {
    -QuadNode root
    -int maxPerLeaf
    +candidateIds(double lat, double lng, double radiusKm) List~Long~
  }
  class GeohashEncoder {
    +encode(double lat, double lng, int precision) String
    +cellAndNeighbors(String hash) List~String~
  }
  class Place {
    +long id
    +String name
    +String category
    +double lat
    +double lng
    +double rating
  }
  class PlaceRepository {
    +findByIds(List~Long~ ids) List~Place~
  }
  class RankingStrategy {
    <<interface>>
    +rank(List~Place~ places, SearchQuery query) List~Place~
  }
  class DistanceRatingRanker {
    -double distanceWeight
    -double ratingWeight
    +rank(List~Place~ places, SearchQuery query) List~Place~
  }
  class SearchCache {
    +get(String key) List~Place~
    +put(String key, List~Place~ result, int ttlSeconds) void
  }
  SearchController --> SearchService
  SearchService ..> SearchQuery
  SearchService --> GeoIndex
  SearchService --> PlaceRepository
  SearchService --> SearchCache
  SearchService --> RankingStrategy
  GeoIndex <|.. GeohashIndex
  GeoIndex <|.. QuadTreeIndex
  GeohashIndex ..> GeohashEncoder
  RankingStrategy <|.. DistanceRatingRanker
  PlaceRepository "1" --> "many" Place`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant API as SearchController
  participant S as SearchService
  participant K as SearchCache
  participant G as GeohashIndex
  participant DB as PlaceRepository
  C->>API: GET /search lat lng radius=2km type=cafe
  API->>S: findNearby(query)
  S->>K: get(cell plus category key)
  alt cache hit
    K-->>S: ranked places
  else cache miss
    K-->>S: null
    S->>G: candidateIds(lat, lng, 2km)
    G->>G: encode center, add 8 neighbor cells
    G-->>S: candidate place ids
    S->>DB: findByIds(ids)
    DB-->>S: place rows
    S->>S: exact haversine filter, category filter, rank
    S->>K: put(key, result, ttl)
  end
  S-->>API: top places
  API-->>C: 200 OK with places`,
    sequenceCaption: "A radius search that checks the cache, then expands the center geohash cell to its neighbors, filters by exact distance and ranks.",
    code: {
      lang: "java",
      caption: "A geohash encoder that interleaves longitude and latitude bits, decodes cell bounds and returns the 3x3 block of cells around a point.",
      code: `import java.util.ArrayList;
import java.util.List;

public final class GeohashEncoder {
    private static final String BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    // Approximate cell width in km for precision 1..8.
    private static final double[] CELL_WIDTH_KM = {5000, 1250, 156, 39, 4.9, 1.2, 0.153, 0.038};

    private GeohashEncoder() {}

    public static String encode(double lat, double lng, int precision) {
        double minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
        StringBuilder hash = new StringBuilder(precision);
        boolean lngBit = true; // geohash starts with a longitude bit
        int bits = 0, value = 0;
        while (hash.length() < precision) {
            if (lngBit) {
                double mid = (minLng + maxLng) / 2;
                if (lng >= mid) { value = (value << 1) | 1; minLng = mid; }
                else { value = value << 1; maxLng = mid; }
            } else {
                double mid = (minLat + maxLat) / 2;
                if (lat >= mid) { value = (value << 1) | 1; minLat = mid; }
                else { value = value << 1; maxLat = mid; }
            }
            lngBit = !lngBit;
            if (++bits == 5) {
                hash.append(BASE32.charAt(value));
                bits = 0;
                value = 0;
            }
        }
        return hash.toString();
    }

    /** Returns minLat, maxLat, minLng, maxLng of the cell. */
    public static double[] bounds(String hash) {
        double minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
        boolean lngBit = true;
        for (char c : hash.toCharArray()) {
            int idx = BASE32.indexOf(c);
            if (idx < 0) throw new IllegalArgumentException("invalid geohash char " + c);
            for (int mask = 16; mask > 0; mask >>= 1) {
                boolean upper = (idx & mask) != 0;
                if (lngBit) {
                    double mid = (minLng + maxLng) / 2;
                    if (upper) minLng = mid; else maxLng = mid;
                } else {
                    double mid = (minLat + maxLat) / 2;
                    if (upper) minLat = mid; else maxLat = mid;
                }
                lngBit = !lngBit;
            }
        }
        return new double[] {minLat, maxLat, minLng, maxLng};
    }

    /** The cell plus its 8 neighbors, so points just across a cell edge are not missed. */
    public static List<String> cellAndNeighbors(String hash) {
        double[] b = bounds(hash);
        double latStep = b[1] - b[0];
        double lngStep = b[3] - b[2];
        double centerLat = (b[0] + b[1]) / 2;
        double centerLng = (b[2] + b[3]) / 2;
        List<String> cells = new ArrayList<>(9);
        for (int dLat = -1; dLat <= 1; dLat++) {
            for (int dLng = -1; dLng <= 1; dLng++) {
                double lat = centerLat + dLat * latStep;
                if (lat > 90 || lat < -90) continue;
                double lng = centerLng + dLng * lngStep;
                if (lng > 180) lng -= 360;     // wrap across the antimeridian
                if (lng < -180) lng += 360;
                String cell = encode(lat, lng, hash.length());
                if (!cells.contains(cell)) cells.add(cell);
            }
        }
        return cells;
    }

    /** Finest precision whose cell is still at least as wide as the search radius. */
    public static int precisionForRadius(double radiusKm) {
        for (int p = CELL_WIDTH_KM.length; p >= 1; p--) {
            if (CELL_WIDTH_KM[p - 1] >= radiusKm) return p;
        }
        return 1;
    }

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}`,
    },
    patterns: [
      { name: "Strategy", where: "GeoIndex has GeohashIndex and QuadTreeIndex implementations, and RankingStrategy lets ranking weights change without touching SearchService." },
      { name: "Repository", where: "PlaceRepository hides the PostGIS place table behind findByIds, so the search logic never writes SQL." },
      { name: "Cache-aside", where: "SearchService reads SearchCache first and fills it on a miss, keyed by geohash cell and category." },
    ],
  },

  "job-scheduler": {
    classDiagram: `classDiagram
  class Job {
    +String id
    +String taskType
    +String payload
    +String cronExpr
    +Instant nextRunAt
    +JobStatus status
    +int attempts
    +isRecurring() boolean
  }
  class JobStatus {
    <<enumeration>>
    PENDING
    QUEUED
    RUNNING
    SUCCEEDED
    FAILED
    DEAD
  }
  class JobRepository {
    +findDue(Instant now, int limit) List~Job~
    +compareAndSetStatus(String jobId, JobStatus from, JobStatus to) boolean
    +reschedule(String jobId, Instant nextRunAt, int attempts) void
  }
  class LeaderElector {
    <<interface>>
    +isLeader() boolean
    +onLeadershipChange(Runnable callback) void
  }
  class Dispatcher {
    -JobRepository jobs
    -JobQueue queue
    -LeaderElector elector
    +tick(Instant now) int
  }
  class JobQueue {
    +enqueue(String jobId, String executionId) void
    +poll() QueuedJob
    +sendToDeadLetter(String jobId) void
  }
  class Worker {
    -JobRepository jobs
    -ExecutionRepository executions
    -Map~String,TaskHandler~ handlers
    -RetryPolicy retryPolicy
    +process(QueuedJob item) void
  }
  class TaskHandler {
    <<interface>>
    +execute(String payload, String executionId) void
  }
  class RetryPolicy {
    -int maxAttempts
    -Duration baseDelay
    +nextDelay(int attempts) Optional~Duration~
  }
  class ExecutionRepository {
    +startIfAbsent(String executionId) boolean
    +markDone(String executionId) void
  }
  Dispatcher --> LeaderElector
  Dispatcher --> JobRepository
  Dispatcher --> JobQueue
  Worker --> JobQueue
  Worker --> JobRepository
  Worker --> ExecutionRepository
  Worker --> RetryPolicy
  Worker "1" --> "many" TaskHandler
  JobRepository "1" --> "many" Job
  Job --> JobStatus`,
    sequenceDiagram: `sequenceDiagram
  participant ZK as LeaderElector
  participant D as Dispatcher
  participant DB as JobRepository
  participant Q as JobQueue
  participant W as Worker
  D->>ZK: isLeader()
  ZK-->>D: true
  D->>DB: findDue(now, 500)
  DB-->>D: due jobs
  D->>DB: compareAndSetStatus(job, PENDING, QUEUED)
  alt claim succeeded
    DB-->>D: 1 row updated
    D->>Q: enqueue(jobId, executionId)
  else already claimed
    DB-->>D: 0 rows updated, skip
  end
  Q->>W: deliver job
  W->>DB: compareAndSetStatus(job, QUEUED, RUNNING)
  W->>W: run handler with executionId
  alt task succeeded
    W->>DB: SUCCEEDED, or PENDING with next cron time
  else task failed
    W->>DB: reschedule with backoff, or DEAD after max attempts
    W->>Q: sendToDeadLetter when attempts exhausted
  end`,
    sequenceCaption: "The leader dispatcher claims due jobs atomically and enqueues them, then a worker runs each one and either reschedules it or retries with backoff.",
    code: {
      lang: "java",
      caption: "A worker that runs a claimed job idempotently by execution id, reschedules recurring jobs and retries failures with exponential backoff before dead-lettering.",
      code: `import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

public class Worker {
    private final JobRepository jobs;
    private final ExecutionRepository executions;
    private final JobQueue queue;
    private final Map<String, TaskHandler> handlers;
    private final RetryPolicy retryPolicy;
    private final CronParser cron;
    private final Clock clock;

    public Worker(JobRepository jobs, ExecutionRepository executions, JobQueue queue,
                  Map<String, TaskHandler> handlers, RetryPolicy retryPolicy,
                  CronParser cron, Clock clock) {
        this.jobs = jobs;
        this.executions = executions;
        this.queue = queue;
        this.handlers = handlers;
        this.retryPolicy = retryPolicy;
        this.cron = cron;
        this.clock = clock;
    }

    public void process(QueuedJob item) {
        // Queue delivery is at-least-once, so a redelivered message must lose this race.
        if (!jobs.compareAndSetStatus(item.jobId(), JobStatus.QUEUED, JobStatus.RUNNING)) {
            return;
        }
        Job job = jobs.findById(item.jobId()).orElseThrow();
        TaskHandler handler = handlers.get(job.getTaskType());
        if (handler == null) {
            jobs.updateStatus(job.getId(), JobStatus.DEAD);
            queue.sendToDeadLetter(job.getId());
            return;
        }
        try {
            if (executions.startIfAbsent(item.executionId())) {
                handler.execute(job.getPayload(), item.executionId());
                executions.markDone(item.executionId());
            }
            onSuccess(job);
        } catch (RuntimeException e) {
            onFailure(job, e);
        }
    }

    private void onSuccess(Job job) {
        if (job.isRecurring()) {
            Instant next = cron.nextAfter(job.getCronExpr(), clock.instant());
            jobs.reschedule(job.getId(), next, 0);
            jobs.updateStatus(job.getId(), JobStatus.PENDING);
        } else {
            jobs.updateStatus(job.getId(), JobStatus.SUCCEEDED);
        }
    }

    private void onFailure(Job job, RuntimeException cause) {
        int attempts = job.getAttempts() + 1;
        Optional<Duration> delay = retryPolicy.nextDelay(attempts);
        if (delay.isPresent()) {
            jobs.reschedule(job.getId(), clock.instant().plus(delay.get()), attempts);
            jobs.updateStatus(job.getId(), JobStatus.PENDING);
        } else {
            jobs.updateStatus(job.getId(), JobStatus.DEAD);
            queue.sendToDeadLetter(job.getId());
        }
    }
}

final class RetryPolicy {
    private final int maxAttempts;
    private final Duration baseDelay;
    private final Duration maxDelay;

    RetryPolicy(int maxAttempts, Duration baseDelay, Duration maxDelay) {
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
    }

    Optional<Duration> nextDelay(int attempts) {
        if (attempts >= maxAttempts) return Optional.empty();
        long factor = 1L << Math.min(attempts - 1, 20);
        Duration d = baseDelay.multipliedBy(factor);
        return Optional.of(d.compareTo(maxDelay) > 0 ? maxDelay : d);
    }
}`,
    },
    patterns: [
      { name: "Command", where: "Each Job carries a taskType and payload that a TaskHandler executes, so new job kinds are added by registering a handler." },
      { name: "State", where: "JobStatus moves PENDING, QUEUED, RUNNING, then SUCCEEDED, PENDING again or DEAD, and every move is a compare-and-set on the row." },
      { name: "Strategy", where: "RetryPolicy encapsulates backoff and max attempts, so a job type can plug in a different retry rule." },
      { name: "Repository", where: "JobRepository and ExecutionRepository hide the SQL for due queries, atomic claims and execution records." },
    ],
  },

  "video-streaming": {
    classDiagram: `classDiagram
  class Video {
    +String id
    +String ownerId
    +String title
    +VideoStatus status
    +String rawObjectKey
    +List~Rendition~ renditions
  }
  class VideoStatus {
    <<enumeration>>
    UPLOADING
    PROCESSING
    READY
    FAILED
  }
  class Rendition {
    +String resolution
    +int bitrateKbps
    +String codec
    +List~Segment~ segments
  }
  class Segment {
    +int index
    +double durationSec
    +String objectKey
  }
  class UploadService {
    -ObjectStore store
    -MetadataService metadata
    +createUploadUrl(String ownerId, String title) UploadTicket
    +onUploadComplete(String videoId) void
  }
  class TranscodeOrchestrator {
    -TaskQueue tasks
    -MetadataService metadata
    +start(Video video) void
    +onTaskDone(TranscodeTask task) void
  }
  class TranscodeTask {
    +String videoId
    +int segmentIndex
    +String profile
    +TaskState state
  }
  class ObjectStore {
    <<interface>>
    +presignPut(String key, Duration ttl) String
    +put(String key, byte[] data) void
  }
  class ManifestBuilder {
    +addRendition(Rendition r) ManifestBuilder
    +build() String
  }
  class MetadataService {
    +save(Video video) void
    +updateStatus(String videoId, VideoStatus status) void
  }
  class AbrSelector {
    -List~Rendition~ ladder
    -double ewmaKbps
    +onChunkDownloaded(long bytes, long millis) void
    +choose(double bufferSec) Rendition
  }
  Video "1" *-- "many" Rendition
  Rendition "1" *-- "many" Segment
  Video --> VideoStatus
  UploadService --> ObjectStore
  UploadService --> MetadataService
  UploadService ..> TranscodeOrchestrator
  TranscodeOrchestrator "1" --> "many" TranscodeTask
  TranscodeOrchestrator --> ManifestBuilder
  TranscodeOrchestrator --> MetadataService
  AbrSelector ..> Rendition`,
    sequenceDiagram: `sequenceDiagram
  participant U as Uploader
  participant UP as UploadService
  participant S3 as ObjectStore
  participant O as TranscodeOrchestrator
  participant W as TranscodeWorkers
  participant M as MetadataService
  U->>UP: POST /videos/upload-url
  UP->>M: save video as UPLOADING
  UP-->>U: presigned_url and video_id
  U->>S3: PUT raw file
  S3-->>UP: upload complete event
  UP->>O: start(video)
  O->>M: updateStatus PROCESSING
  O->>W: fan out one task per segment and profile
  W->>S3: write encoded chunks
  W-->>O: onTaskDone(task)
  alt all tasks done
    O->>S3: write HLS manifests built by ManifestBuilder
    O->>M: updateStatus READY
  else a task failed
    O->>W: retry that segment only
    O->>M: updateStatus FAILED after max retries
  end`,
    sequenceCaption: "An upload through a presigned URL that fans out per-segment transcoding tasks and publishes the manifest once every rendition is complete.",
    code: {
      lang: "java",
      caption: "A player-side adaptive bitrate selector that smooths measured throughput and uses buffer level to decide when to step quality up or down.",
      code: `import java.util.Comparator;
import java.util.List;

public class AbrSelector {
    private static final double ALPHA = 0.3;          // weight of the newest throughput sample
    private static final double SAFETY = 0.8;         // only use 80 percent of measured bandwidth
    private static final double LOW_BUFFER_SEC = 8;
    private static final double HIGH_BUFFER_SEC = 25;

    private final List<Rendition> ladder;             // sorted from lowest to highest bitrate
    private double ewmaKbps = -1;
    private int currentIndex = 0;

    public AbrSelector(List<Rendition> renditions) {
        if (renditions.isEmpty()) throw new IllegalArgumentException("empty bitrate ladder");
        this.ladder = renditions.stream()
                .sorted(Comparator.comparingInt(Rendition::bitrateKbps))
                .toList();
    }

    public void onChunkDownloaded(long bytes, long millis) {
        if (millis <= 0) return;
        double sampleKbps = (bytes * 8.0) / millis;   // bits per ms equals kilobits per second
        ewmaKbps = ewmaKbps < 0 ? sampleKbps : ALPHA * sampleKbps + (1 - ALPHA) * ewmaKbps;
    }

    public Rendition choose(double bufferSec) {
        if (ewmaKbps < 0) {
            return ladder.get(currentIndex);          // no samples yet: start at the bottom
        }
        int target = highestAffordable(ewmaKbps * SAFETY);

        if (bufferSec < LOW_BUFFER_SEC) {
            // Close to stalling: drop at least one step even if bandwidth looks fine.
            target = Math.min(target, Math.max(0, currentIndex - 1));
        } else if (target > currentIndex) {
            // Step up one rung at a time, and only with a healthy buffer, to avoid flapping.
            target = bufferSec >= HIGH_BUFFER_SEC ? currentIndex + 1 : currentIndex;
        }
        currentIndex = target;
        return ladder.get(currentIndex);
    }

    private int highestAffordable(double budgetKbps) {
        int best = 0;
        for (int i = 0; i < ladder.size(); i++) {
            if (ladder.get(i).bitrateKbps() <= budgetKbps) {
                best = i;
            }
        }
        return best;
    }

    public double estimatedKbps() {
        return ewmaKbps;
    }
}

record Rendition(String resolution, int bitrateKbps, String codec, String playlistUrl) {}`,
    },
    patterns: [
      { name: "Fan-out / fan-in", where: "TranscodeOrchestrator creates one TranscodeTask per segment and profile, then joins on onTaskDone before marking the video READY." },
      { name: "Builder", where: "ManifestBuilder assembles the HLS master playlist one rendition at a time." },
      { name: "State", where: "VideoStatus moves UPLOADING, PROCESSING, then READY or FAILED, and playback is only allowed in READY." },
      { name: "Strategy", where: "AbrSelector is a pluggable quality policy on the player, so throughput-based and buffer-based rules can be swapped." },
    ],
  },

  "ride-hailing": {
    classDiagram: `classDiagram
  class Driver {
    +String id
    +double rating
    +DriverStatus status
    +String vehicleType
  }
  class DriverStatus {
    <<enumeration>>
    OFFLINE
    AVAILABLE
    OFFERED
    ON_TRIP
  }
  class Ride {
    +String id
    +String riderId
    +String driverId
    +Location pickup
    +Location dropoff
    +RideState state
    +transitionTo(RideState next) void
  }
  class RideState {
    <<enumeration>>
    REQUESTED
    ACCEPTED
    ARRIVED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }
  class LocationService {
    -GeoIndex geo
    +updateLocation(String driverId, double lat, double lng) void
  }
  class GeoIndex {
    <<interface>>
    +upsert(String driverId, double lat, double lng) void
    +nearby(double lat, double lng, double radiusKm, int limit) List~String~
  }
  class RedisGeoIndex {
    -String keyPrefix
    +upsert(String driverId, double lat, double lng) void
    +nearby(double lat, double lng, double radiusKm, int limit) List~String~
  }
  class DriverStateStore {
    +compareAndSet(String driverId, DriverStatus from, DriverStatus to) boolean
  }
  class MatchingService {
    -GeoIndex geo
    -DriverStateStore states
    -DriverRanker ranker
    -TripRepository trips
    +match(Ride ride) Optional~Ride~
  }
  class DriverRanker {
    <<interface>>
    +rank(List~String~ driverIds, Location pickup) List~String~
  }
  class TripRepository {
    +save(Ride ride) void
    +assignDriver(String rideId, String driverId) boolean
  }
  LocationService --> GeoIndex
  GeoIndex <|.. RedisGeoIndex
  MatchingService --> GeoIndex
  MatchingService --> DriverStateStore
  MatchingService --> DriverRanker
  MatchingService --> TripRepository
  Driver --> DriverStatus
  Ride --> RideState
  Ride "many" --> "1" Driver
  TripRepository "1" --> "many" Ride`,
    sequenceDiagram: `sequenceDiagram
  participant D as DriverApp
  participant L as LocationService
  participant G as RedisGeoIndex
  participant R as RiderApp
  participant M as MatchingService
  participant S as DriverStateStore
  participant T as TripRepository
  D->>L: POST /drivers/d1/location lat lng
  L->>G: GEOADD cell key d1
  L-->>D: 200 OK
  R->>M: POST /rides pickup dropoff
  M->>T: save ride REQUESTED
  M->>G: nearby(pickup, 3km, 20)
  G-->>M: candidate driver ids
  M->>M: filter and rank by ETA and rating
  M->>S: compareAndSet(d1, AVAILABLE, OFFERED)
  alt driver claimed
    S-->>M: true
    M->>D: offer ride
    D-->>M: accept
    M->>T: assignDriver, state ACCEPTED
    M-->>R: ride_id, driver, eta
  else driver already taken
    S-->>M: false
    M->>S: try next ranked driver
  end`,
    sequenceCaption: "A driver location ping lands in the in-memory geo index, then a ride request finds nearby drivers and atomically claims one.",
    code: {
      lang: "java",
      caption: "A matching service that ranks nearby drivers and claims exactly one with a compare-and-set, releasing it if the driver declines the offer.",
      code: `import java.time.Duration;
import java.util.List;
import java.util.Optional;

public class MatchingService {
    private static final double SEARCH_RADIUS_KM = 3.0;
    private static final int MAX_CANDIDATES = 20;
    private static final Duration OFFER_TIMEOUT = Duration.ofSeconds(15);

    private final GeoIndex geo;
    private final DriverStateStore states;
    private final DriverRanker ranker;
    private final TripRepository trips;
    private final OfferGateway offers;

    public MatchingService(GeoIndex geo, DriverStateStore states, DriverRanker ranker,
                           TripRepository trips, OfferGateway offers) {
        this.geo = geo;
        this.states = states;
        this.ranker = ranker;
        this.trips = trips;
        this.offers = offers;
    }

    public Optional<Ride> match(Ride ride) {
        Location p = ride.getPickup();
        List<String> nearby = geo.nearby(p.lat(), p.lng(), SEARCH_RADIUS_KM, MAX_CANDIDATES);
        List<String> ranked = ranker.rank(nearby, p);

        for (String driverId : ranked) {
            // Two riders can see the same driver as nearest; only one CAS wins.
            if (!states.compareAndSet(driverId, DriverStatus.AVAILABLE, DriverStatus.OFFERED)) {
                continue;
            }
            boolean accepted = offers.offer(driverId, ride.getId(), OFFER_TIMEOUT);
            if (!accepted) {
                states.compareAndSet(driverId, DriverStatus.OFFERED, DriverStatus.AVAILABLE);
                continue;
            }
            // Guard the ride row too, in case the rider cancelled while we were offering.
            if (!trips.assignDriver(ride.getId(), driverId)) {
                states.compareAndSet(driverId, DriverStatus.OFFERED, DriverStatus.AVAILABLE);
                return Optional.empty();
            }
            states.compareAndSet(driverId, DriverStatus.OFFERED, DriverStatus.ON_TRIP);
            ride.assign(driverId);
            ride.transitionTo(RideState.ACCEPTED);
            return Optional.of(ride);
        }
        return Optional.empty();
    }
}

enum RideState {
    REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED;

    boolean canMoveTo(RideState next) {
        return switch (this) {
            case REQUESTED -> next == ACCEPTED || next == CANCELLED;
            case ACCEPTED -> next == ARRIVED || next == CANCELLED;
            case ARRIVED -> next == IN_PROGRESS || next == CANCELLED;
            case IN_PROGRESS -> next == COMPLETED;
            case COMPLETED, CANCELLED -> false;
        };
    }
}

class Ride {
    private final String id;
    private final Location pickup;
    private String driverId;
    private RideState state = RideState.REQUESTED;

    Ride(String id, Location pickup) {
        this.id = id;
        this.pickup = pickup;
    }

    void transitionTo(RideState next) {
        if (!state.canMoveTo(next)) {
            throw new IllegalStateException(state + " cannot move to " + next);
        }
        state = next;
    }

    void assign(String driverId) { this.driverId = driverId; }
    String getId() { return id; }
    Location getPickup() { return pickup; }
    RideState getState() { return state; }
}

record Location(double lat, double lng) {}`,
    },
    patterns: [
      { name: "State", where: "RideState.canMoveTo enforces the lifecycle REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, and Ride.transitionTo rejects illegal jumps." },
      { name: "Strategy", where: "DriverRanker hides the scoring rule (ETA, rating, acceptance rate) so matching logic stays the same when ranking changes." },
      { name: "Optimistic concurrency (compare-and-set)", where: "DriverStateStore.compareAndSet and TripRepository.assignDriver make sure one driver goes to one ride." },
      { name: "Adapter", where: "RedisGeoIndex adapts Redis GEOADD and GEOSEARCH to the GeoIndex interface used by LocationService and MatchingService." },
    ],
  },

  "file-sync": {
    classDiagram: `classDiagram
  class FileEntry {
    +String fileId
    +String path
    +String ownerId
    +long version
    +List~String~ chunkHashes
    +VersionVector vector
  }
  class Chunk {
    +String hash
    +int size
    +byte[] data
  }
  class Chunker {
    -int chunkSize
    +split(Path file) List~Chunk~
  }
  class VersionVector {
    -Map~String,Long~ counters
    +increment(String deviceId) VersionVector
    +compare(VersionVector other) Ordering
  }
  class SyncClient {
    -Chunker chunker
    -MetadataApi metadata
    -ChunkStore chunks
    +upload(Path file, FileEntry base) CommitResult
  }
  class MetadataApi {
    <<interface>>
    +missingChunks(List~String~ hashes) Set~String~
    +commit(String fileId, long baseVersion, List~String~ hashes, String deviceId) CommitResult
    +changesSince(String deviceId, long cursor) List~FileEntry~
  }
  class MetadataService {
    -FileRepository files
    -ChangeNotifier notifier
    +commit(String fileId, long baseVersion, List~String~ hashes, String deviceId) CommitResult
  }
  class FileRepository {
    +findById(String fileId) Optional~FileEntry~
    +updateIfVersion(FileEntry entry, long expectedVersion) boolean
  }
  class ChunkStore {
    <<interface>>
    +exists(String hash) boolean
    +put(String hash, byte[] data) void
    +get(String hash) byte[]
  }
  class ChangeNotifier {
    +publish(String ownerId, FileEntry changed) void
    +subscribe(String deviceId, ChangeListener listener) void
  }
  SyncClient --> Chunker
  SyncClient --> MetadataApi
  SyncClient --> ChunkStore
  MetadataApi <|.. MetadataService
  MetadataService --> FileRepository
  MetadataService --> ChangeNotifier
  FileRepository "1" --> "many" FileEntry
  FileEntry *-- VersionVector
  FileEntry "many" o-- "many" Chunk : references by hash
  Chunker ..> Chunk`,
    sequenceDiagram: `sequenceDiagram
  participant A as SyncClient
  participant M as MetadataService
  participant S as ChunkStore
  participant N as ChangeNotifier
  participant B as OtherDevice
  A->>A: split file into 4MB chunks and hash each
  A->>M: missingChunks(hashes)
  M-->>A: only hashes not yet stored
  A->>S: put each missing chunk
  A->>M: commit(fileId, baseVersion, hashes, deviceId)
  alt base version is current
    M->>M: updateIfVersion, version plus 1
    M->>N: publish(owner, entry)
    M-->>A: COMMITTED with new version
    N-->>B: change notification
    B->>M: GET /files/id/changes since cursor
    M-->>B: changeset with chunk hashes
    B->>S: get only the chunks it lacks
  else another device committed first
    M-->>A: CONFLICT with current version
    A->>A: keep local copy as a conflicted file
  end`,
    sequenceCaption: "A delta upload that sends only missing chunks, commits metadata against a base version and either notifies other devices or reports a conflict.",
    code: {
      lang: "java",
      caption: "A sync client that chunks and hashes a file, uploads only chunks the server lacks and commits with optimistic version checking.",
      code: `import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class SyncClient {
    private static final int CHUNK_SIZE = 4 * 1024 * 1024;

    private final MetadataApi metadata;
    private final ChunkStore chunks;
    private final ConflictHandler conflicts;
    private final String deviceId;

    public SyncClient(MetadataApi metadata, ChunkStore chunks, ConflictHandler conflicts, String deviceId) {
        this.metadata = metadata;
        this.chunks = chunks;
        this.conflicts = conflicts;
        this.deviceId = deviceId;
    }

    public CommitResult upload(Path file, FileEntry base) throws IOException {
        // LinkedHashMap keeps chunk order, which defines the file content.
        Map<String, byte[]> byHash = split(file);
        List<String> orderedHashes = new ArrayList<>(byHash.keySet());

        Set<String> missing = metadata.missingChunks(orderedHashes);
        for (String hash : missing) {
            chunks.put(hash, byHash.get(hash));
        }

        CommitResult result = metadata.commit(base.fileId(), base.version(), orderedHashes, deviceId);
        if (result.status() == CommitStatus.CONFLICT) {
            // Never overwrite the other device's edit: keep both copies.
            conflicts.saveAsConflictedCopy(file, deviceId, result.currentVersion());
        }
        return result;
    }

    Map<String, byte[]> split(Path file) throws IOException {
        Map<String, byte[]> out = new LinkedHashMap<>();
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buffer = new byte[CHUNK_SIZE];
            int read;
            while ((read = in.readNBytes(buffer, 0, CHUNK_SIZE)) > 0) {
                byte[] data = java.util.Arrays.copyOf(buffer, read);
                out.putIfAbsent(sha256(data), data);
            }
        }
        return out;
    }

    private static String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}

enum CommitStatus { COMMITTED, CONFLICT }

record CommitResult(CommitStatus status, long currentVersion) {}

record FileEntry(String fileId, String path, long version, List<String> chunkHashes) {}

interface MetadataApi {
    Set<String> missingChunks(List<String> hashes);
    CommitResult commit(String fileId, long baseVersion, List<String> hashes, String deviceId);
}

interface ChunkStore {
    void put(String hash, byte[] data);
}

interface ConflictHandler {
    void saveAsConflictedCopy(Path file, String deviceId, long serverVersion);
}`,
    },
    patterns: [
      { name: "Content-addressed storage", where: "ChunkStore keys every chunk by its SHA-256 hash, so identical chunks across files, versions and users are stored once." },
      { name: "Optimistic concurrency", where: "MetadataService.commit uses FileRepository.updateIfVersion with the base version, and a stale base returns CONFLICT instead of overwriting." },
      { name: "Observer", where: "ChangeNotifier publishes committed changes to subscribed devices, which then pull the changeset." },
      { name: "Repository", where: "FileRepository owns the strongly consistent file, version and chunk list rows." },
    ],
  },

  "ticket-booking": {
    classDiagram: `classDiagram
  class Show {
    +String id
    +String eventId
    +Instant startsAt
  }
  class Seat {
    +String id
    +String showId
    +String row
    +int number
    +SeatState state
    +String reservationId
    +Instant holdExpiresAt
  }
  class SeatState {
    <<enumeration>>
    AVAILABLE
    RESERVED
    BOOKED
  }
  class Reservation {
    +String id
    +String userId
    +List~String~ seatIds
    +Instant expiresAt
    +ReservationStatus status
  }
  class Booking {
    +String id
    +String reservationId
    +String paymentId
  }
  class ReservationService {
    -SeatRepository seats
    -ReservationRepository reservations
    -PaymentClient payments
    +reserve(String userId, String showId, List~String~ seatIds) Reservation
    +confirm(String reservationId, String paymentToken, String idemKey) Booking
  }
  class SeatRepository {
    +holdIfAvailable(String showId, List~String~ seatIds, String reservationId, Instant expiresAt) int
    +markBooked(String reservationId) int
    +releaseExpired(Instant now) int
  }
  class ReservationRepository {
    +save(Reservation r) void
    +findById(String id) Optional~Reservation~
    +findBookingByIdemKey(String idemKey) Optional~Booking~
  }
  class PaymentClient {
    <<interface>>
    +charge(String token, long amountMinor, String idemKey) PaymentResult
  }
  class HoldExpiryJob {
    -SeatRepository seats
    +run() void
  }
  class WaitingRoom {
    +admit(String userId) AdmissionToken
    +isAdmitted(String token) boolean
  }
  Show "1" *-- "many" Seat
  Seat --> SeatState
  Reservation "1" --> "1..many" Seat
  Booking "1" --> "1" Reservation
  ReservationService --> SeatRepository
  ReservationService --> ReservationRepository
  ReservationService --> PaymentClient
  HoldExpiryJob --> SeatRepository
  WaitingRoom ..> ReservationService`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant W as WaitingRoom
  participant R as ReservationService
  participant DB as InventoryDB
  participant P as PaymentClient
  C->>W: join queue for show
  W-->>C: admission token
  C->>R: POST /events/id/reserve seat_ids
  R->>DB: UPDATE seat SET RESERVED WHERE state AVAILABLE
  alt every seat updated
    DB-->>R: rows equal seat count
    R-->>C: reservation_id and expires_at
  else some seat already taken
    DB-->>R: fewer rows, transaction rolled back
    R-->>C: 409 seats unavailable
  end
  C->>R: POST /reservations/id/confirm token idem_key
  R->>P: charge(token, amount, idem_key)
  alt payment succeeded and hold still valid
    P-->>R: approved
    R->>DB: mark seats BOOKED, insert booking
    R-->>C: booking confirmed
  else payment failed or hold expired
    P-->>R: declined
    R->>DB: release seats to AVAILABLE
    R-->>C: 402 payment failed
  end`,
    sequenceCaption: "Reserve seats with an all-or-nothing compare-and-set, then confirm with an idempotent payment that books the seats or releases them.",
    code: {
      lang: "java",
      caption: "A reservation service that holds seats with a conditional update inside one transaction and confirms bookings idempotently.",
      code: `import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class ReservationService {
    private static final Duration HOLD_TTL = Duration.ofMinutes(10);

    private final SeatRepository seats;
    private final ReservationRepository reservations;
    private final PaymentClient payments;
    private final TransactionRunner tx;
    private final Clock clock;

    public ReservationService(SeatRepository seats, ReservationRepository reservations,
                              PaymentClient payments, TransactionRunner tx, Clock clock) {
        this.seats = seats;
        this.reservations = reservations;
        this.payments = payments;
        this.tx = tx;
        this.clock = clock;
    }

    public Reservation reserve(String userId, String showId, List<String> seatIds) {
        String reservationId = UUID.randomUUID().toString();
        Instant expiresAt = clock.instant().plus(HOLD_TTL);
        return tx.inTransaction(() -> {
            // UPDATE seat SET state='RESERVED', reservation_id=?, hold_expires_at=?
            // WHERE show_id=? AND id IN (...) AND state='AVAILABLE'
            int held = seats.holdIfAvailable(showId, seatIds, reservationId, expiresAt);
            if (held != seatIds.size()) {
                throw new SeatsUnavailableException(seatIds); // rolls back the partial hold
            }
            Reservation r = new Reservation(reservationId, userId, showId, seatIds, expiresAt,
                    ReservationStatus.HELD);
            reservations.save(r);
            return r;
        });
    }

    public Booking confirm(String reservationId, String paymentToken, String idemKey) {
        Optional<Booking> existing = reservations.findBookingByIdemKey(idemKey);
        if (existing.isPresent()) {
            return existing.get(); // client retry after a timeout
        }
        Reservation r = reservations.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("unknown reservation " + reservationId));
        if (r.status() != ReservationStatus.HELD || clock.instant().isAfter(r.expiresAt())) {
            throw new HoldExpiredException(reservationId);
        }

        PaymentResult payment = payments.charge(paymentToken, priceOf(r), idemKey);
        if (!payment.approved()) {
            tx.inTransaction(() -> seats.release(reservationId));
            throw new PaymentDeclinedException(payment.reason());
        }

        return tx.inTransaction(() -> {
            // The expiry job may have released the hold between the check and the charge.
            int booked = seats.markBooked(reservationId);
            if (booked != r.seatIds().size()) {
                payments.refund(payment.paymentId(), idemKey + ":refund");
                throw new HoldExpiredException(reservationId);
            }
            Booking b = new Booking(UUID.randomUUID().toString(), reservationId, payment.paymentId(), idemKey);
            reservations.saveBooking(b);
            reservations.updateStatus(reservationId, ReservationStatus.CONFIRMED);
            return b;
        });
    }

    private long priceOf(Reservation r) {
        return seats.totalPriceMinor(r.showId(), r.seatIds());
    }
}`,
    },
    patterns: [
      { name: "State", where: "SeatState moves AVAILABLE to RESERVED to BOOKED, and RESERVED falls back to AVAILABLE on expiry or payment failure. Every move is a guarded UPDATE." },
      { name: "Repository", where: "SeatRepository wraps the conditional seat updates, and ReservationRepository looks up bookings by idempotency key." },
      { name: "Idempotency key", where: "confirm returns the stored Booking for a repeated idemKey, and the same key goes to PaymentClient so a retry is never charged twice." },
      { name: "Scheduled sweeper", where: "HoldExpiryJob periodically runs releaseExpired so abandoned holds return seats to inventory." },
    ],
  },

  "distributed-cache": {
    classDiagram: `classDiagram
  class CacheClient {
    -HashRing ring
    -Map~String,NodeConnection~ connections
    +get(String key) Optional~byte[]~
    +set(String key, byte[] value, int ttlSeconds) void
    +delete(String key) void
  }
  class HashRing {
    -TreeMap~Long,String~ ring
    -int virtualNodes
    +addNode(String nodeId) void
    +removeNode(String nodeId) void
    +nodesFor(String key, int replicas) List~String~
  }
  class CacheNode {
    -String id
    -LruStore store
    -Replicator replicator
    +get(String key) Optional~byte[]~
    +set(String key, byte[] value, long expiresAtMs) void
  }
  class LruStore {
    -Map~String,Entry~ index
    -Entry head
    -Entry tail
    -long capacityBytes
    +get(String key) Entry
    +put(String key, byte[] value, long expiresAtMs) void
    -evictUntilFits() void
  }
  class Entry {
    +String key
    +byte[] value
    +long expiresAtMs
    +Entry prev
    +Entry next
  }
  class EvictionPolicy {
    <<interface>>
    +onAccess(String key) void
    +victim() String
  }
  class LruPolicy
  class LfuPolicy
  class Replicator {
    -List~String~ replicaIds
    +replicateAsync(String key, byte[] value, long expiresAtMs) void
  }
  class GossipMembership {
    -Map~String,Long~ lastHeartbeat
    +isAlive(String nodeId) boolean
    +onNodeDown(Consumer~String~ listener) void
  }
  CacheClient --> HashRing
  CacheClient "1" --> "many" CacheNode
  CacheNode *-- LruStore
  CacheNode --> Replicator
  LruStore "1" *-- "many" Entry
  LruStore --> EvictionPolicy
  EvictionPolicy <|.. LruPolicy
  EvictionPolicy <|.. LfuPolicy
  GossipMembership ..> HashRing : removes dead nodes`,
    sequenceDiagram: `sequenceDiagram
  participant C as App
  participant CL as CacheClient
  participant H as HashRing
  participant P as PrimaryNode
  participant R as ReplicaNode
  participant G as GossipMembership
  C->>CL: set(user42, value, ttl 300)
  CL->>H: nodesFor(user42, 2)
  H-->>CL: primary N1, replica N2
  CL->>G: isAlive(N1)
  alt primary alive
    G-->>CL: true
    CL->>P: SET user42 EX 300
    P->>P: put into LruStore, evict tail if full
    P-->>CL: OK
    P-)R: replicate asynchronously
  else primary down
    G-->>CL: false
    G->>H: removeNode(N1)
    CL->>R: SET user42 EX 300 on promoted replica
    R-->>CL: OK
  end
  CL-->>C: OK`,
    sequenceCaption: "A SET routed by the consistent hash ring to the key's primary, with async replication, or to the promoted replica when gossip reports the primary down.",
    code: {
      lang: "java",
      caption: "A consistent hash ring with virtual nodes that maps a key to its primary and the next distinct nodes clockwise as replicas.",
      code: `import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class HashRing {
    private final TreeMap<Long, String> ring = new TreeMap<>();
    private final Set<String> nodes = new LinkedHashSet<>();
    private final int virtualNodes;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    public HashRing(Collection<String> initialNodes, int virtualNodes) {
        this.virtualNodes = virtualNodes;
        initialNodes.forEach(this::addNode);
    }

    public void addNode(String nodeId) {
        lock.writeLock().lock();
        try {
            if (!nodes.add(nodeId)) return;
            for (int i = 0; i < virtualNodes; i++) {
                ring.put(hash(nodeId + "#vn" + i), nodeId);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void removeNode(String nodeId) {
        lock.writeLock().lock();
        try {
            if (!nodes.remove(nodeId)) return;
            for (int i = 0; i < virtualNodes; i++) {
                ring.remove(hash(nodeId + "#vn" + i));
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    /** First entry is the primary; the rest are distinct physical nodes for replicas. */
    public List<String> nodesFor(String key, int count) {
        lock.readLock().lock();
        try {
            if (ring.isEmpty()) throw new IllegalStateException("no cache nodes");
            int wanted = Math.min(count, nodes.size());
            Set<String> picked = new LinkedHashSet<>();
            long h = hash(key);
            // Walk clockwise from the key, wrapping around to the start of the ring.
            SortedMap<Long, String> tail = ring.tailMap(h);
            for (String node : tail.values()) {
                if (picked.size() == wanted) break;
                picked.add(node);
            }
            for (Map.Entry<Long, String> e : ring.entrySet()) {
                if (picked.size() == wanted || e.getKey() >= h) break;
                picked.add(e.getValue());
            }
            return new ArrayList<>(picked);
        } finally {
            lock.readLock().unlock();
        }
    }

    public String primaryFor(String key) {
        return nodesFor(key, 1).get(0);
    }

    private static long hash(String s) {
        try {
            byte[] d = MessageDigest.getInstance("MD5").digest(s.getBytes(StandardCharsets.UTF_8));
            long h = 0;
            for (int i = 0; i < 8; i++) {
                h = (h << 8) | (d[i] & 0xff);
            }
            return h;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}`,
    },
    patterns: [
      { name: "Consistent hashing with virtual nodes", where: "HashRing places each physical node at many ring positions, so a join or leave moves only about 1/N of keys." },
      { name: "Strategy", where: "EvictionPolicy has LruPolicy and LfuPolicy implementations that LruStore consults when memory is full." },
      { name: "Observer", where: "GossipMembership notifies listeners on node failure, and the client removes the node from HashRing and routes to the replica." },
      { name: "Proxy", where: "CacheClient presents a single get and set API and forwards each call to the right CacheNode connection." },
    ],
  },

  "message-queue": {
    classDiagram: `classDiagram
  class Producer {
    -Partitioner partitioner
    -Map~Integer,BrokerConnection~ leaders
    +send(String topic, String key, byte[] value) long
  }
  class Partitioner {
    <<interface>>
    +partition(String key, int partitionCount) int
  }
  class HashPartitioner {
    +partition(String key, int partitionCount) int
  }
  class Broker {
    -int brokerId
    -Map~String,Partition~ partitions
    +append(String topic, int partition, Record r, Acks acks) long
    +fetch(String topic, int partition, long offset, int max) List~Record~
  }
  class Partition {
    -int id
    -PartitionLog log
    -ReplicaManager replicas
    -boolean leader
  }
  class PartitionLog {
    -TreeMap~Long,LogSegment~ segments
    -long nextOffset
    -long highWatermark
    +append(byte[] key, byte[] value) long
    +read(long offset, int maxRecords) List~Record~
    +advanceHighWatermark(long offset) void
  }
  class LogSegment {
    +long baseOffset
    +List~Record~ records
    +long sizeBytes
  }
  class Record {
    +long offset
    +byte[] key
    +byte[] value
    +long timestamp
  }
  class ReplicaManager {
    -Set~Integer~ isr
    -Map~Integer,Long~ followerOffsets
    +onFollowerFetch(int followerId, long offset) long
  }
  class ConsumerGroup {
    -String groupId
    -Map~Integer,String~ assignment
    +rebalance(List~String~ members, int partitions) void
  }
  class OffsetStore {
    +commit(String group, String topic, int partition, long offset) void
    +fetch(String group, String topic, int partition) long
  }
  Producer --> Partitioner
  Partitioner <|.. HashPartitioner
  Producer ..> Broker
  Broker "1" *-- "many" Partition
  Partition *-- PartitionLog
  Partition *-- ReplicaManager
  PartitionLog "1" *-- "many" LogSegment
  LogSegment "1" *-- "many" Record
  ConsumerGroup --> OffsetStore
  ConsumerGroup ..> Broker`,
    sequenceDiagram: `sequenceDiagram
  participant P as Producer
  participant L as LeaderBroker
  participant F as FollowerBroker
  participant C as Consumer
  participant O as OffsetStore
  P->>P: hash key to partition 3
  P->>L: produce(orders, key, value) acks all
  L->>L: append to PartitionLog, offset 1042
  F->>L: fetch from offset 1042
  L-->>F: record 1042
  F->>L: next fetch at 1043 confirms copy
  alt all ISR members caught up
    L->>L: advance high watermark to 1043
    L-->>P: ack offset 1042
  else follower lagging past timeout
    L->>L: shrink ISR, then advance
    L-->>P: ack offset 1042
  end
  C->>O: fetch committed offset for group
  O-->>C: 1042
  C->>L: poll partition 3 from 1042
  L-->>C: records below high watermark
  C->>C: process records
  C->>O: commit(group, orders, 3, 1043)`,
    sequenceCaption: "A keyed produce with acks=all that waits for in-sync replicas before acking, then a consumer polls from its committed offset and commits the next one.",
    code: {
      lang: "java",
      caption: "A partition log that appends records into size-capped segments, finds the segment for any offset and only exposes records below the high watermark.",
      code: `import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class PartitionLog {
    private final TreeMap<Long, LogSegment> segments = new TreeMap<>();
    private final long maxSegmentBytes;
    private long nextOffset = 0;
    private long highWatermark = 0;   // first offset not yet replicated to every ISR member

    public PartitionLog(long maxSegmentBytes) {
        this.maxSegmentBytes = maxSegmentBytes;
        segments.put(0L, new LogSegment(0L));
    }

    public synchronized long append(byte[] key, byte[] value) {
        LogSegment active = segments.lastEntry().getValue();
        int size = recordSize(key, value);
        if (active.sizeBytes + size > maxSegmentBytes && !active.records.isEmpty()) {
            active = new LogSegment(nextOffset);
            segments.put(nextOffset, active);
        }
        long offset = nextOffset++;
        active.records.add(new Record(offset, key, value, System.currentTimeMillis()));
        active.sizeBytes += size;
        return offset;
    }

    /** Consumers never see records above the high watermark, so a leader failover cannot un-deliver them. */
    public synchronized List<Record> read(long fromOffset, int maxRecords) {
        List<Record> out = new ArrayList<>(maxRecords);
        if (fromOffset >= highWatermark) return out;
        Map.Entry<Long, LogSegment> entry = segments.floorEntry(fromOffset);
        if (entry == null) throw new OffsetOutOfRangeException(fromOffset);

        for (LogSegment seg : segments.tailMap(entry.getKey(), true).values()) {
            int start = (int) Math.max(0, fromOffset - seg.baseOffset);
            for (int i = start; i < seg.records.size(); i++) {
                Record r = seg.records.get(i);
                if (r.offset() >= highWatermark || out.size() == maxRecords) return out;
                out.add(r);
            }
        }
        return out;
    }

    public synchronized void advanceHighWatermark(long offset) {
        if (offset > highWatermark && offset <= nextOffset) {
            highWatermark = offset;
        }
    }

    /** Retention: drop whole segments older than the cutoff, never the active one. */
    public synchronized int deleteSegmentsBefore(long cutoffMillis) {
        int removed = 0;
        while (segments.size() > 1) {
            LogSegment oldest = segments.firstEntry().getValue();
            List<Record> rs = oldest.records;
            if (rs.isEmpty() || rs.get(rs.size() - 1).timestamp() >= cutoffMillis) break;
            segments.pollFirstEntry();
            removed++;
        }
        return removed;
    }

    public synchronized long logEndOffset() { return nextOffset; }
    public synchronized long highWatermark() { return highWatermark; }

    private static int recordSize(byte[] key, byte[] value) {
        return 24 + (key == null ? 0 : key.length) + value.length;
    }

    static final class LogSegment {
        final long baseOffset;
        final List<Record> records = new ArrayList<>();
        long sizeBytes;

        LogSegment(long baseOffset) { this.baseOffset = baseOffset; }
    }

    public record Record(long offset, byte[] key, byte[] value, long timestamp) {}

    public static final class OffsetOutOfRangeException extends RuntimeException {
        OffsetOutOfRangeException(long offset) { super("offset out of range: " + offset); }
    }
}`,
    },
    patterns: [
      { name: "Append-only log", where: "PartitionLog only appends and rolls segments by size, and retention deletes whole segments instead of single records." },
      { name: "Strategy", where: "Partitioner lets the producer choose HashPartitioner for per-key ordering or a round-robin implementation for unkeyed traffic." },
      { name: "Leader and followers (replicated log)", where: "ReplicaManager tracks follower offsets and the ISR, and the leader advances the high watermark only when the ISR has the record." },
      { name: "Memento-like checkpoint", where: "OffsetStore saves each group's committed offset, so a restarted consumer resumes or replays from a known point." },
    ],
  },

  "collaborative-editor": {
    classDiagram: `classDiagram
  class Operation {
    +OpType type
    +int position
    +char ch
    +String clientId
    +int baseRevision
  }
  class OpType {
    <<enumeration>>
    INSERT
    DELETE
    NOOP
  }
  class CollabWebSocketHandler {
    -DocumentRegistry registry
    +onMessage(Session session, Operation op) void
    +onClose(Session session) void
  }
  class DocumentRegistry {
    -Map~String,DocumentSession~ open
    +getOrLoad(String docId) DocumentSession
  }
  class DocumentSession {
    -String docId
    -StringBuilder text
    -List~Operation~ history
    -Set~Session~ editors
    +submit(Operation op) Operation
    +broadcast(Operation op, int revision) void
  }
  class OtTransformer {
    +transform(Operation incoming, Operation applied) Operation
  }
  class OpLogRepository {
    +append(String docId, int revision, Operation op) void
    +readFrom(String docId, int fromRevision) List~Operation~
  }
  class SnapshotStore {
    +save(String docId, int revision, String text) void
    +latest(String docId) Snapshot
  }
  class PresenceService {
    +publishCursor(String docId, String userId, int position) void
  }
  CollabWebSocketHandler --> DocumentRegistry
  CollabWebSocketHandler --> PresenceService
  DocumentRegistry "1" --> "many" DocumentSession
  DocumentSession --> OtTransformer
  DocumentSession --> OpLogRepository
  DocumentSession --> SnapshotStore
  DocumentSession "1" *-- "many" Operation : history
  Operation --> OpType`,
    sequenceDiagram: `sequenceDiagram
  participant A as UserA
  participant B as UserB
  participant H as CollabWebSocketHandler
  participant D as DocumentSession
  participant L as OpLogRepository
  A->>H: insert x at 5, baseRev 7
  B->>H: delete at 2, baseRev 7
  H->>D: submit(A op)
  D->>D: baseRev equals current rev 7, apply as is
  D->>L: append rev 8
  D-->>A: ack rev 8
  D-->>B: broadcast A op as rev 8
  H->>D: submit(B op)
  alt baseRev is current
    D->>D: apply directly
  else baseRev is behind
    D->>D: transform against rev 8 history
  end
  D->>L: append rev 9
  D-->>B: ack rev 9
  D-->>A: broadcast transformed B op as rev 9`,
    sequenceCaption: "Two concurrent edits arrive at the document's sticky server, which orders them, transforms the stale one against history and broadcasts both.",
    code: {
      lang: "java",
      caption: "A server-side document session that transforms a client operation against everything applied since its base revision, then applies, logs and broadcasts it.",
      code: `import java.util.ArrayList;
import java.util.List;

public class DocumentSession {
    private final String docId;
    private final StringBuilder text;
    private final List<Operation> history = new ArrayList<>(); // index i holds revision i + 1
    private final OpLogRepository opLog;
    private final Broadcaster broadcaster;
    private final int baseRevision;                              // revision of the loaded snapshot

    public DocumentSession(String docId, String snapshotText, int snapshotRevision,
                           OpLogRepository opLog, Broadcaster broadcaster) {
        this.docId = docId;
        this.text = new StringBuilder(snapshotText);
        this.baseRevision = snapshotRevision;
        this.opLog = opLog;
        this.broadcaster = broadcaster;
    }

    public synchronized int revision() {
        return baseRevision + history.size();
    }

    public synchronized int submit(Operation op) {
        if (op.baseRevision() < baseRevision || op.baseRevision() > revision()) {
            throw new IllegalArgumentException("client must resync, bad base revision " + op.baseRevision());
        }
        Operation transformed = op;
        for (int rev = op.baseRevision(); rev < revision(); rev++) {
            transformed = transform(transformed, history.get(rev - baseRevision));
        }
        apply(transformed);
        history.add(transformed);
        int newRev = revision();
        opLog.append(docId, newRev, transformed);
        broadcaster.toAllExcept(docId, op.clientId(), transformed, newRev);
        broadcaster.ack(docId, op.clientId(), newRev);
        return newRev;
    }

    private void apply(Operation op) {
        switch (op.type()) {
            case INSERT -> text.insert(op.position(), op.ch());
            case DELETE -> text.deleteCharAt(op.position());
            case NOOP -> { }
        }
    }

    /** Rewrites incoming so it has the same intent after applied has already run. */
    static Operation transform(Operation incoming, Operation applied) {
        if (incoming.type() == OpType.NOOP || applied.type() == OpType.NOOP) return incoming;
        int p = incoming.position();
        int q = applied.position();
        if (incoming.type() == OpType.INSERT && applied.type() == OpType.INSERT) {
            // Same spot: break the tie by client id so every replica picks the same order.
            boolean shift = q < p || (q == p && applied.clientId().compareTo(incoming.clientId()) < 0);
            return shift ? incoming.withPosition(p + 1) : incoming;
        }
        if (incoming.type() == OpType.INSERT) {          // applied is a DELETE
            return q < p ? incoming.withPosition(p - 1) : incoming;
        }
        if (applied.type() == OpType.INSERT) {           // incoming is a DELETE
            return q <= p ? incoming.withPosition(p + 1) : incoming;
        }
        if (q == p) return incoming.asNoop();            // both deleted the same character
        return q < p ? incoming.withPosition(p - 1) : incoming;
    }

    public synchronized String text() {
        return text.toString();
    }
}

enum OpType { INSERT, DELETE, NOOP }

record Operation(OpType type, int position, char ch, String clientId, int baseRevision) {
    Operation withPosition(int pos) { return new Operation(type, pos, ch, clientId, baseRevision); }
    Operation asNoop() { return new Operation(OpType.NOOP, position, ch, clientId, baseRevision); }
}

interface OpLogRepository { void append(String docId, int revision, Operation op); }

interface Broadcaster {
    void toAllExcept(String docId, String clientId, Operation op, int revision);
    void ack(String docId, String clientId, int revision);
}`,
    },
    patterns: [
      { name: "Command", where: "Each edit is an Operation object (INSERT, DELETE, NOOP) that is transformed, applied, logged and replayed instead of saving the whole document." },
      { name: "Event sourcing with snapshots", where: "OpLogRepository is the append-only history, and SnapshotStore lets DocumentRegistry load a document without replaying every operation." },
      { name: "Observer", where: "DocumentSession broadcasts each applied operation to every subscribed editor session, and PresenceService fans out cursors." },
      { name: "Registry (single owner per document)", where: "DocumentRegistry keeps one in-memory DocumentSession per docId on the sticky server, making it the authority for ordering." },
    ],
  },

  "payment-system": {
    classDiagram: `classDiagram
  class PaymentController {
    -PaymentService service
    +createPayment(PaymentRequest req, String idemKey) PaymentResponse
  }
  class PaymentService {
    -IdempotencyStore idempotency
    -PaymentRepository payments
    -ProcessorGateway processor
    -LedgerService ledger
    +pay(PaymentRequest req) PaymentResult
    +onWebhook(ProcessorEvent event) void
  }
  class Payment {
    +String id
    +String idemKey
    +long amountMinor
    +String currency
    +String sourceAccount
    +String merchantAccount
    +PaymentState state
  }
  class PaymentState {
    <<enumeration>>
    CREATED
    AUTHORIZED
    CAPTURED
    PENDING
    SETTLED
    FAILED
    REFUNDED
  }
  class IdempotencyStore {
    +claim(String key, String fingerprint) IdempotencyRecord
    +complete(String key, PaymentResult result) void
  }
  class PaymentRepository {
    +insert(Payment p) Payment
    +transition(String id, PaymentState from, PaymentState to) boolean
  }
  class ProcessorGateway {
    <<interface>>
    +authorize(String token, long amountMinor, String idemKey) AuthResult
    +capture(String authId, String idemKey) CaptureResult
    +refund(String captureId, String idemKey) RefundResult
  }
  class CardProcessorAdapter {
    -HttpClient http
    +authorize(String token, long amountMinor, String idemKey) AuthResult
  }
  class LedgerService {
    +postTransfer(String txId, String debitAccount, String creditAccount, long amountMinor) void
  }
  class LedgerEntry {
    +String txId
    +String account
    +long debitMinor
    +long creditMinor
    +Instant createdAt
  }
  class ReconciliationJob {
    +reconcile(LocalDate day) List~Mismatch~
  }
  PaymentController --> PaymentService
  PaymentService --> IdempotencyStore
  PaymentService --> PaymentRepository
  PaymentService --> ProcessorGateway
  PaymentService --> LedgerService
  ProcessorGateway <|.. CardProcessorAdapter
  PaymentRepository "1" --> "many" Payment
  Payment --> PaymentState
  LedgerService "1" --> "many" LedgerEntry
  ReconciliationJob --> LedgerService
  ReconciliationJob --> ProcessorGateway`,
    sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant S as PaymentService
  participant I as IdempotencyStore
  participant P as ProcessorGateway
  participant L as LedgerService
  C->>S: POST /payments amount source dest idem_key
  S->>I: claim(idem_key, fingerprint)
  alt key already completed
    I-->>S: stored result
    S-->>C: same response as the first call
  else new key
    I-->>S: claimed
    S->>S: insert Payment CREATED
    S->>P: authorize(token, amount, idem_key)
    alt approved
      P-->>S: authId
      S->>P: capture(authId)
      P-->>S: captured
      S->>L: postTransfer debit customer, credit merchant
      S->>S: state CAPTURED
    else declined
      P-->>S: declined
      S->>S: state FAILED
    end
    S->>I: complete(idem_key, result)
    S-->>C: payment status
  end`,
    sequenceCaption: "An idempotent charge that claims the key first, authorizes and captures through the processor adapter, and records a balanced ledger transfer.",
    code: {
      lang: "java",
      caption: "An idempotent payment service that runs authorize, capture and ledger posting as saga steps, compensating with a refund if the ledger write fails.",
      code: `public class PaymentService {
    private final IdempotencyStore idempotency;
    private final PaymentRepository payments;
    private final ProcessorGateway processor;
    private final LedgerService ledger;

    public PaymentService(IdempotencyStore idempotency, PaymentRepository payments,
                          ProcessorGateway processor, LedgerService ledger) {
        this.idempotency = idempotency;
        this.payments = payments;
        this.processor = processor;
        this.ledger = ledger;
    }

    public PaymentResult pay(PaymentRequest req) {
        // Claimed before any side effect, so two concurrent retries cannot both charge.
        IdempotencyRecord rec = idempotency.claim(req.idemKey(), req.fingerprint());
        if (rec.isCompleted()) {
            return rec.result();
        }
        if (!rec.claimedByThisCall()) {
            throw new RequestInProgressException(req.idemKey());
        }
        if (!rec.fingerprint().equals(req.fingerprint())) {
            throw new IllegalArgumentException("idempotency key reused with a different body");
        }

        Payment payment = payments.insert(Payment.created(req));
        PaymentResult result;
        try {
            result = runSaga(payment, req);
        } catch (ProcessorTimeoutException e) {
            // Outcome unknown: a webhook or reconciliation decides, never a blind retry.
            payments.transition(payment.id(), payment.state(), PaymentState.PENDING);
            result = PaymentResult.pending(payment.id());
        }
        idempotency.complete(req.idemKey(), result);
        return result;
    }

    private PaymentResult runSaga(Payment payment, PaymentRequest req) {
        AuthResult auth = processor.authorize(req.sourceToken(), req.amountMinor(), req.idemKey() + ":auth");
        if (!auth.approved()) {
            payments.transition(payment.id(), PaymentState.CREATED, PaymentState.FAILED);
            return PaymentResult.failed(payment.id(), auth.declineCode());
        }
        payments.transition(payment.id(), PaymentState.CREATED, PaymentState.AUTHORIZED);

        CaptureResult capture = processor.capture(auth.authId(), req.idemKey() + ":capture");
        if (!capture.succeeded()) {
            processor.voidAuthorization(auth.authId(), req.idemKey() + ":void");
            payments.transition(payment.id(), PaymentState.AUTHORIZED, PaymentState.FAILED);
            return PaymentResult.failed(payment.id(), "capture_failed");
        }

        try {
            // Debit and credit rows are written in one ACID transaction inside the ledger.
            ledger.postTransfer(payment.id(), req.customerAccount(), req.merchantAccount(), req.amountMinor());
        } catch (RuntimeException ledgerFailure) {
            processor.refund(capture.captureId(), req.idemKey() + ":refund");
            payments.transition(payment.id(), PaymentState.AUTHORIZED, PaymentState.REFUNDED);
            return PaymentResult.failed(payment.id(), "ledger_unavailable");
        }
        payments.transition(payment.id(), PaymentState.AUTHORIZED, PaymentState.CAPTURED);
        return PaymentResult.captured(payment.id(), capture.captureId());
    }
}

class LedgerService {
    private final LedgerRepository entries;
    private final TransactionRunner tx;

    LedgerService(LedgerRepository entries, TransactionRunner tx) {
        this.entries = entries;
        this.tx = tx;
    }

    void postTransfer(String txId, String debitAccount, String creditAccount, long amountMinor) {
        if (amountMinor <= 0) throw new IllegalArgumentException("amount must be positive");
        tx.inTransaction(() -> {
            entries.insert(new LedgerEntry(txId, debitAccount, amountMinor, 0));
            entries.insert(new LedgerEntry(txId, creditAccount, 0, amountMinor));
            return null;
        });
    }
}

record LedgerEntry(String txId, String account, long debitMinor, long creditMinor) {}`,
    },
    patterns: [
      { name: "Saga orchestrator", where: "PaymentService.runSaga drives authorize, capture and ledger posting, and compensates with void or refund when a later step fails." },
      { name: "State", where: "PaymentState moves CREATED, AUTHORIZED, CAPTURED (or PENDING, FAILED, REFUNDED), and each move is a guarded transition in PaymentRepository." },
      { name: "Adapter", where: "CardProcessorAdapter implements ProcessorGateway, so each external processor's API is hidden behind one interface." },
      { name: "Idempotency key", where: "IdempotencyStore.claim and complete make retries return the stored result, and derived keys are passed to every processor call." },
    ],
  },
};
