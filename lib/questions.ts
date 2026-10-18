import type { Difficulty, Question } from "./types";

export const OVERVIEW_DIAGRAM = `graph LR
  C(["Clients"]) --> LB["Load Balancer"]
  LB --> S1["Service"]
  LB --> S2["Service"]
  S1 --> CACHE{{"Cache"}}
  S2 --> Q[["Queue"]]
  CACHE --> DB[("Database")]
  Q --> DB`;

export const QUESTIONS: Question[] = [
  {
    slug: "url-shortener",
    title: "URL Shortener",
    company: "TinyURL · Bit.ly",
    difficulty: "easy",
    tags: ["base62", "key-gen", "read-heavy"],
    requirements: {
      functional: ["Shorten a long URL to a unique short link", "Redirect a short link to the original URL", "Optional custom alias and link expiry", "Basic click analytics"],
      nonFunctional: ["Very high availability: a dead link is unacceptable", "Minimal redirect latency", "Read-heavy, about 100:1 reads to writes", "Short keys must not be guessable"],
    },
    scale: [
      { value: "100M", label: "new URLs / month" },
      { value: "~40/s", label: "writes" },
      { value: "~4,000/s", label: "reads" },
      { value: "~6B", label: "URLs over 5 years" },
      { value: "7 chars", label: "base62 gives 3.5T keys" },
      { value: "~500GB/yr", label: "storage" },
    ],
    concepts: [
      { term: "Base62 encoding", def: "[a-zA-Z0-9] gives 62^7, about 3.5 trillion keys in 7 characters, compact and URL-safe." },
      { term: "Key Generation Service", def: "Pre-generates random keys offline so writes never do collision checks." },
      { term: "Cache-aside", def: "Check the cache, fall back to the database on a miss, then populate the cache." },
      { term: "301 vs 302", def: "301 is cached by the browser (fast, no analytics); 302 sends every click through you." },
    ],
    diagram: `graph LR
  C(["Client"]) --> LB["Load Balancer"] --> APP["App Server"]
  APP --> KGS[["Key Gen Service"]]
  APP --> CACHE{{"Redis Cache"}}
  APP --> DB[("URL Store")]
  CACHE --> DB`,
    hld: [
      "Client goes through DNS and a load balancer to stateless app servers.",
      "Write path: take a unique key from the Key Generation Service, store key to URL, return the short link.",
      "Read path: look up the key in the cache, fall back to the database, return an HTTP redirect.",
      "Redis caches hot links; a CDN can cache redirects at the edge.",
    ],
    api: ["// create", "POST /api/v1/urls { long_url, custom_alias?, expiry? } -> { short_url }", "// redirect", "GET /{short_key} -> 302 Location: long_url"],
    lld: [
      "**Key generation:** a KGS pre-generates random base62 keys and marks them used when issued, so there are no collisions and keys are not sequential. Alternative: base62-encode an auto-increment counter.",
      "**Data model:** `mapping(short_key PK, long_url, user_id, created_at, expires_at)`, a pure key-value lookup.",
      "**Redirect code:** 302 keeps every click visible for analytics; 301 is faster because the browser caches it.",
      "**Cleanup:** a background job purges expired links and keys can be recycled.",
    ],
    stack: [
      { layer: "App servers", pick: "Go / Java", why: "Stateless and horizontally scalable; compiled languages keep redirect latency low." },
      { layer: "Storage", pick: "Cassandra / DynamoDB", why: "Single-key lookups at high write volume suit a key-value store better than a relational one." },
      { layer: "Cache", pick: "Redis", why: "Redirect is the hottest read path, so hot links are served from memory." },
      { layer: "Edge", pick: "CDN", why: "Caches redirects near users and offloads the origin." },
      { layer: "Coordination", pick: "ZooKeeper", why: "Hands counter ranges to servers so keys stay unique without a central bottleneck." },
    ],
    tradeoffs: [
      { question: "How to generate keys?", a: "Hash the URL (MD5) and truncate.", b: "KGS pre-generates random keys offline.", verdict: "KGS: no collision checks at write time, non-sequential keys, and generation is off the hot path." },
      { question: "301 or 302 redirect?", a: "301 permanent, cached by the browser, fastest.", b: "302 temporary, every click reaches you.", verdict: "302 if analytics matter; 301 only when raw speed matters more than measurement." },
      { question: "SQL or NoSQL?", a: "SQL: transactional and familiar.", b: "NoSQL: scales writes and storage horizontally.", verdict: "NoSQL key-value: there are no relations, just billions of independent lookups." },
    ],
  },
  {
    slug: "rate-limiter",
    title: "API Rate Limiter",
    company: "Stripe · Cloudflare",
    difficulty: "easy",
    tags: ["token-bucket", "sliding-window", "redis"],
    requirements: {
      functional: ["Limit requests per client (user, IP or API key) per time window", "Return HTTP 429 when the limit is exceeded", "Configurable rules per endpoint and tier", "Expose remaining quota in response headers"],
      nonFunctional: ["Low added latency, since it sits in the request path", "Works across many distributed servers", "Memory-efficient at scale", "A clear fail-open or fail-closed policy"],
    },
    scale: [
      { value: "1M+/s", label: "checks" },
      { value: "<1ms", label: "budget per check" },
      { value: "per key", label: "counters" },
      { value: "TTL", label: "auto-expiring state" },
    ],
    concepts: [
      { term: "Token bucket", def: "A bucket refills at a fixed rate and each request spends a token. Allows short bursts." },
      { term: "Sliding window counter", def: "A weighted blend of the current and previous window: accurate and cheap." },
      { term: "Atomic operations", def: "Redis INCR with EXPIRE, or a Lua script, makes check-and-increment race-free." },
      { term: "Fail-open vs fail-closed", def: "When the limiter is down, either allow traffic (availability) or block it (protection)." },
    ],
    diagram: `graph LR
  C(["Client"]) --> GW["API Gateway"] --> RL["Rate Limiter"]
  RL --> R{{"Redis Counters"}}
  RL -->|"allow"| SVC["Service"]
  RL -->|"429"| C`,
    hld: [
      "Rate-limiter middleware sits at the API gateway, before business logic.",
      "For each request it builds a key (user plus endpoint), checks a counter in a shared store, then allows or rejects.",
      "Rules live in configuration and reload without a deploy.",
      "A shared Redis cluster holds the counters so the limit is global across all servers.",
    ],
    api: ["// allowed", "200 OK  X-RateLimit-Remaining: 42", "// blocked", "429 Too Many Requests  Retry-After: 30"],
    lld: [
      "**Token bucket:** refills at a fixed rate up to a capacity and allows bursts (used by Stripe and AWS).",
      "**Leaky bucket:** requests drain at a constant rate, which smooths traffic.",
      "**Fixed window:** simple per-minute counts, but allows a 2x burst at the window boundary.",
      "**Sliding window log:** one timestamp per request. Accurate but memory-heavy.",
      "**Sliding window counter:** blends two windows. Accurate with low memory, the common production choice.",
      "**Atomicity:** run check-and-increment in one Redis Lua script so concurrent requests cannot race.",
    ],
    stack: [
      { layer: "Enforcement", pick: "API Gateway", why: "Centralizes the check before traffic reaches services; Kong and Envoy have it built in." },
      { layer: "Counter store", pick: "Redis", why: "Atomic in-memory operations with TTL, shared by all servers, fast enough for the request path." },
      { layer: "Rules", pick: "Config in Redis / DB", why: "Per-tier and per-endpoint limits that reload at runtime." },
    ],
    tradeoffs: [
      { question: "Where do counters live?", a: "Local memory on each server.", b: "A central Redis with one global limit.", verdict: "Central for correctness, with a small local cache in front for extreme throughput." },
      { question: "Which algorithm?", a: "Fixed window, the cheapest.", b: "Sliding window counter.", verdict: "Sliding window counter: no boundary burst and low memory." },
      { question: "What if Redis fails?", a: "Fail-open: let requests through.", b: "Fail-closed: reject everything.", verdict: "Usually fail-open. Fail-closed only when the limiter protects something expensive or abusable." },
    ],
  },
  {
    slug: "pastebin",
    title: "Pastebin",
    company: "Classic",
    difficulty: "easy",
    tags: ["blob-storage", "cdn", "ttl"],
    requirements: {
      functional: ["Create a text paste and get a unique URL", "Read a paste by URL", "Optional expiry and private links", "Syntax highlighting (client side)"],
      nonFunctional: ["Read-heavy and highly available", "Pastes can be several MB, so bodies stay out of the primary database", "Low read latency through caching and a CDN"],
    },
    scale: [
      { value: "1M", label: "pastes / day" },
      { value: "~12/s", label: "writes" },
      { value: "~1,200/s", label: "reads" },
      { value: "10KB", label: "average size" },
      { value: "~3.6TB/yr", label: "content" },
    ],
    concepts: [
      { term: "Metadata / blob split", def: "Small structured rows in a database; large immutable bodies in object storage." },
      { term: "Object storage", def: "S3-style durable, cheap and practically unlimited storage for blobs." },
      { term: "CDN caching", def: "Immutable content caches perfectly at the edge." },
      { term: "Lifecycle TTL", def: "Storage-native rules delete expired objects without any compute." },
    ],
    diagram: `graph LR
  C(["Client"]) --> APP["App Server"]
  APP --> META[("Metadata DB")]
  APP --> OBJ[("Object Storage")]
  C -->|"read"| CDN{{"CDN"}}
  CDN --> OBJ`,
    hld: [
      "Same key-generation approach as the URL shortener.",
      "Metadata (key, owner, expiry, size) goes in a database; the content goes in object storage.",
      "Write: generate a key, upload the body to S3, store the metadata row.",
      "Read: look up metadata, fetch the body through the CDN, render.",
    ],
    api: ["POST /api/v1/pastes { content, expiry?, visibility? } -> { key, url }", "GET  /api/v1/pastes/{key} -> { content, meta }"],
    lld: [
      "**Key:** base62 from a KGS, identical to the URL shortener.",
      "**Metadata:** `paste(key PK, s3_path, owner, created_at, expires_at, visibility)`.",
      "**Content:** an S3 object keyed by the paste key, never a database blob, because blobs bloat the database and hurt caching.",
      "**Expiry:** S3 lifecycle rules delete bodies and a light job clears metadata.",
      "**CDN:** bodies never change after they are written, so they can be cached aggressively.",
    ],
    stack: [
      { layer: "Metadata DB", pick: "PostgreSQL / DynamoDB", why: "Small structured rows and simple lookups." },
      { layer: "Content store", pick: "S3", why: "Cheap and durable, scales to petabytes of immutable blobs." },
      { layer: "Cache / edge", pick: "Redis + CDN", why: "Immutable content is ideal for caching." },
    ],
    tradeoffs: [
      { question: "Where does the body go?", a: "A TEXT or BLOB column in the database.", b: "Object storage, with the database holding a pointer.", verdict: "Object storage: the database stays small and fast, storage scales on its own, and content is cacheable." },
      { question: "How to expire pastes?", a: "A sweeper job deletes rows.", b: "Storage-native TTL rules.", verdict: "Lifecycle rules for blobs (no compute) plus a light job for metadata." },
    ],
  },
  {
    slug: "unique-id-generator",
    title: "Unique ID Generator",
    company: "Twitter Snowflake",
    difficulty: "easy",
    tags: ["snowflake", "distributed", "time-sortable"],
    requirements: {
      functional: ["Generate globally unique IDs at a high rate", "IDs are roughly sortable by time", "No central bottleneck or single point of failure", "Unique across data centers"],
      nonFunctional: ["64-bit numeric IDs", "Highly available with low latency", "Roughly increasing order", "Safe across machine restarts"],
    },
    scale: [
      { value: "10k+/s", label: "IDs per node" },
      { value: "64-bit", label: "ID width" },
      { value: "1024", label: "machines (10 bits)" },
      { value: "4096", label: "IDs per ms per node" },
    ],
    concepts: [
      { term: "Snowflake ID", def: "64 bits made of timestamp, machine id and sequence, generated locally with no coordination per ID." },
      { term: "Clock skew", def: "If a node's clock jumps backwards, IDs could collide, so the generator must wait or refuse." },
      { term: "Monotonicity", def: "IDs grow over time, which helps database index locality and sorting." },
      { term: "UUID vs Snowflake", def: "UUID is 128-bit random and unsortable but needs no coordination; Snowflake is compact and sortable." },
    ],
    diagram: `graph TD
  ZK[["ZooKeeper"]] -->|"machine id"| N1["Node A"]
  ZK -->|"machine id"| N2["Node B"]
  N1 --> ID1(["64-bit ID"])
  N2 --> ID2(["64-bit ID"])`,
    hld: [
      "Each service node generates IDs locally, with no network call per ID.",
      "Layout: timestamp (41 bits), machine id (10 bits), sequence (12 bits).",
      "A coordination service (ZooKeeper) assigns each node a unique machine id at startup.",
    ],
    api: ["// in-process library call, no network hop", "long id = snowflake.nextId()"],
    lld: [
      "**64-bit layout:** 1 unused sign bit, a 41-bit millisecond timestamp (about 69 years from a custom epoch), a 10-bit machine id (1024 nodes) and a 12-bit sequence (4096 IDs per ms per node).",
      "**Sequence:** within the same millisecond, increment the sequence; if it overflows, wait for the next millisecond.",
      "**Clock skew (the hard edge case):** if the clock moves backwards, wait until it catches up or refuse to issue. Never emit a smaller timestamp.",
      "**Machine id:** assigned from ZooKeeper or etcd so two nodes never share one.",
      "**No database on the hot path:** generation is pure arithmetic in memory.",
    ],
    stack: [
      { layer: "Generator", pick: "Embedded library", why: "Runs inside each service: no latency and no bottleneck." },
      { layer: "Machine id", pick: "ZooKeeper / etcd", why: "Hands out unique node ids so sequences never collide." },
      { layer: "Clock", pick: "NTP-synced hosts", why: "Keeps timestamps aligned across machines." },
    ],
    tradeoffs: [
      { question: "Which ID scheme?", a: "UUID v4: 128-bit random, no coordination.", b: "Snowflake: 64-bit, sortable, needs a machine id.", verdict: "Snowflake for compact, time-sortable IDs with better index locality; UUID when you want zero coordination." },
      { question: "Central or distributed?", a: "Database auto-increment or a ticket server.", b: "Local Snowflake generation.", verdict: "Local generation: no single point of failure and no network round trip per ID." },
    ],
  },
  {
    slug: "web-crawler",
    title: "Web Crawler",
    company: "Googlebot",
    difficulty: "medium",
    tags: ["bfs", "bloom-filter", "politeness"],
    requirements: {
      functional: ["Start from seed URLs and fetch pages", "Extract links and keep crawling", "Store page content for indexing", "Respect robots.txt and crawl politely"],
      nonFunctional: ["Billions of pages, horizontally scalable", "No re-crawling of known URLs; detect duplicate content", "Never hammer a single domain", "Handle traps, redirects and freshness"],
    },
    scale: [
      { value: "1B", label: "pages / month" },
      { value: "~400/s", label: "pages fetched" },
      { value: "100KB", label: "average page" },
      { value: "~100TB/mo", label: "raw content" },
      { value: "billions", label: "URLs seen" },
    ],
    concepts: [
      { term: "URL frontier", def: "Priority queues plus per-host queues that feed fetchers while enforcing politeness." },
      { term: "Bloom filter", def: "A probabilistic 'seen before?' check in very little memory, with rare false positives." },
      { term: "Politeness", def: "robots.txt, crawl delay and capped concurrency per host." },
      { term: "Content dedup", def: "Hashing or SimHash skips identical and near-duplicate pages." },
    ],
    diagram: `graph LR
  SEED(["Seeds"]) --> FR[["URL Frontier"]]
  FR --> W["Fetcher Workers"]
  W --> PROC["Content Processor"]
  PROC --> STORE[("Content Store")]
  PROC --> SEEN{{"Seen URLs"}}
  PROC -->|"new links"| FR`,
    hld: [
      "A URL frontier (priority and politeness queues) feeds the fetcher workers.",
      "Workers resolve DNS, download the page and hand it to the content processor.",
      "The processor extracts links, dedups content, stores the page and enqueues new URLs.",
      "A seen-URL service (Bloom filter plus a store) stops known URLs from being added again.",
    ],
    api: ["// internal queue contract", "frontier.enqueue(url, priority, host)", "frontier.next(worker) -> url (rate-limited per host)"],
    lld: [
      "**Frontier:** front queues order by priority; back queues are per host so one worker handles one domain with a delay. This is the core of the design.",
      "**URL dedup:** a Bloom filter gives a cheap 'probably seen'; a persistent set confirms it.",
      "**Content dedup:** hash each page (SHA-256, or SimHash for near duplicates) to skip mirrors.",
      "**Politeness:** cache robots.txt per domain, enforce crawl delay, cap concurrent connections.",
      "**Traps:** cap depth and page count per domain to escape infinite link loops.",
      "**BFS over DFS:** spreads load across domains instead of hammering one.",
    ],
    stack: [
      { layer: "Frontier", pick: "Kafka / custom queues", why: "Durable and partitioned by host for politeness and parallelism." },
      { layer: "Dedup", pick: "Bloom filter + RocksDB", why: "Constant-time membership in little memory, with a KV store as the source of truth." },
      { layer: "Content store", pick: "S3 / HDFS", why: "Cheap bulk storage that feeds the indexer." },
      { layer: "Workers", pick: "Stateless fetcher fleet", why: "Scale out freely, isolated by host assignment." },
    ],
    tradeoffs: [
      { question: "Which dedup structure?", a: "Exact hash set: accurate, heavy.", b: "Bloom filter: tiny, small false-positive rate.", verdict: "Bloom filter up front, with a persistent set as the source of truth." },
      { question: "Traversal order?", a: "DFS: deep into one site.", b: "BFS: across many sites.", verdict: "BFS: spreads load, finds important shallow pages first, and spares individual domains." },
    ],
  },
  {
    slug: "notification-system",
    title: "Notification System",
    company: "Any large app",
    difficulty: "medium",
    tags: ["pub-sub", "at-least-once", "retry"],
    requirements: {
      functional: ["Send push, SMS and email", "Templates in multiple languages", "User preferences and opt-out", "Dedup and rate limits per user"],
      nonFunctional: ["High throughput, fully asynchronous", "At-least-once delivery with retries", "Producers decoupled from providers", "Track sent, failed and opened"],
    },
    scale: [
      { value: "100M", label: "notifications / day" },
      { value: "~1,200/s", label: "average" },
      { value: "10x", label: "peak bursts" },
      { value: "3", label: "channels" },
    ],
    concepts: [
      { term: "Pub/sub and queues", def: "Producers publish events; channel workers consume them independently." },
      { term: "At-least-once", def: "Never drop a message; tolerate rare duplicates through idempotency." },
      { term: "Dead-letter queue", def: "Messages that still fail after N retries are parked here for inspection." },
      { term: "Provider abstraction", def: "One adapter per provider so you can fail over (Twilio to a backup)." },
    ],
    diagram: `graph LR
  SVC["Services"] --> NS["Notification Service"]
  NS --> Q[["Channel Queues"]]
  Q --> W["Channel Workers"]
  W --> P{{"Providers"}}
  W --> LOG[("Delivery Log")]`,
    hld: [
      "Services publish events to the notification service.",
      "It validates, applies preferences and rate limits, renders the template and enqueues one message per channel.",
      "Channel workers consume the queues and call providers (APNS/FCM, Twilio, SES).",
      "A dedup and preference store plus a delivery log track state; repeated failures go to a dead-letter queue.",
    ],
    api: ["POST /notify { user_id, type, channel[], template_id, data } -> 202 Accepted"],
    lld: [
      "**Queue per channel:** isolate push, SMS and email so a slow provider does not block the others.",
      "**Idempotency:** a dedup key and a seen-set drop duplicates, which at-least-once delivery will produce.",
      "**Retry:** exponential backoff; after N attempts the message moves to the dead-letter queue.",
      "**Preferences:** check opt-outs and quiet hours before enqueuing.",
      "**Templates:** stored centrally with variables and rendered per locale.",
      "**Provider adapter:** swap or fail over providers without touching producers.",
    ],
    stack: [
      { layer: "Queue", pick: "Kafka / SQS", why: "Absorbs bursts, decouples producers, enables retries and replay." },
      { layer: "Workers", pick: "Stateless consumers", why: "Each channel scales with its own queue depth." },
      { layer: "Providers", pick: "APNS/FCM, Twilio, SES", why: "Use specialists behind an adapter instead of building delivery infrastructure." },
      { layer: "State", pick: "Cassandra / Redis", why: "High-write delivery logs and fast dedup and preference lookups." },
    ],
    tradeoffs: [
      { question: "Delivery guarantee?", a: "At-most-once: no duplicates, may drop.", b: "At-least-once: no drops, may duplicate.", verdict: "At-least-once with idempotency: a rare duplicate is better than a missed OTP." },
      { question: "Sync or async?", a: "Synchronous: the caller waits.", b: "Asynchronous through a queue.", verdict: "Asynchronous: never tie your latency to a third-party provider." },
    ],
  },
  {
    slug: "news-feed",
    title: "News Feed",
    company: "Facebook · X",
    difficulty: "medium",
    tags: ["fan-out", "celebrity-problem", "timeline"],
    requirements: {
      functional: ["Users post and followers see it in a feed", "Feed ranked by recency or relevance", "Follow and unfollow", "Feed loads fast on open"],
      nonFunctional: ["Read-heavy with low feed latency", "Huge fan-out for popular accounts", "Eventual consistency is acceptable"],
    },
    scale: [
      { value: "500M", label: "DAU" },
      { value: "~10:1", label: "read:write" },
      { value: "avg 200", label: "follows per user" },
      { value: "millions", label: "followers per celebrity" },
    ],
    concepts: [
      { term: "Fan-out on write", def: "Push a post into every follower's feed when it is created. Fast reads." },
      { term: "Fan-out on read", def: "Build the feed when it is opened. Cheap writes, expensive reads." },
      { term: "Celebrity problem", def: "Pushing one post to millions of feeds is wasteful, so mix push and pull." },
      { term: "Timeline cache", def: "A per-user list of post ids in Redis, filled in with post bodies on read." },
    ],
    diagram: `graph LR
  U(["User Post"]) --> PS["Post Service"] --> PDB[("Post Store")]
  PS --> FO[["Fan-out Service"]]
  FO --> FC{{"Feed Cache"}}
  R(["Reader"]) --> FS["Feed Service"] --> FC
  FS --> PDB`,
    hld: [
      "Write: the post service stores the post, then the fan-out service pushes its id into followers' feed caches.",
      "Read: the feed service reads the precomputed feed, fills in posts, ranks and returns them.",
      "A graph service stores follows; media goes to object storage behind a CDN.",
    ],
    api: ["POST /posts { content, media? } -> { post_id }", "GET  /feed?cursor=... -> { posts[], next_cursor }"],
    lld: [
      "**Fan-out on write (push):** write the post id into every follower's list for instant reads. Best for normal users.",
      "**Fan-out on read (pull):** query followed accounts at read time for cheap writes. Best for celebrities.",
      "**Celebrity problem:** a hybrid that pushes for normal users and pulls celebrity posts, merging them at read time.",
      "**Feed cache:** keep the latest few hundred post ids per user and fetch bodies separately.",
      "**Ranking:** start reverse-chronological, then add an ML score (engagement, affinity, recency).",
    ],
    stack: [
      { layer: "Feed cache", pick: "Redis", why: "Per-user post-id lists for instant feed loads." },
      { layer: "Post store", pick: "Cassandra", why: "High write volume, time-ordered, scalable." },
      { layer: "Graph", pick: "Graph / KV store", why: "Fast follower lookups for fan-out." },
      { layer: "Fan-out", pick: "Kafka + workers", why: "Async fan-out keeps posting fast even with huge follower counts." },
      { layer: "Media", pick: "S3 + CDN", why: "Served from the edge instead of app servers." },
    ],
    tradeoffs: [
      { question: "How to build the feed?", a: "Fan-out on write: fast reads, costly writes.", b: "Fan-out on read: cheap writes, slow reads.", verdict: "Hybrid: push for most users, pull for celebrities, merge at read time." },
      { question: "Feed consistency?", a: "Strong: instant and ordered.", b: "Eventual: appears within seconds.", verdict: "Eventual: a feed a few seconds stale is fine and enables caching and async fan-out." },
    ],
  },
  {
    slug: "chat-system",
    title: "Chat / Messaging",
    company: "WhatsApp · Slack",
    difficulty: "medium",
    tags: ["websocket", "presence", "ordering"],
    requirements: {
      functional: ["1:1 and group messaging", "Real-time delivery with sent, delivered and read receipts", "Online and last-seen presence", "History and offline delivery"],
      nonFunctional: ["Low-latency two-way delivery", "Ordered messages per conversation", "Hundreds of millions of connections", "Durable history"],
    },
    scale: [
      { value: "500M", label: "DAU" },
      { value: "50B", label: "messages / day" },
      { value: "persistent", label: "WebSocket connections" },
      { value: "~64B", label: "text message" },
    ],
    concepts: [
      { term: "WebSocket", def: "A persistent full-duplex connection, so the server can push instantly." },
      { term: "Connection registry", def: "Maps each user to a gateway server so messages reach the right socket." },
      { term: "Message ordering", def: "Per-conversation sequence numbers keep order consistent across devices." },
      { term: "Presence / heartbeat", def: "Periodic pings track online state and last seen." },
    ],
    diagram: `graph LR
  A(["User A"]) -->|"WebSocket"| GW["Gateway"]
  GW --> CS["Chat Service"]
  CS --> REG{{"Conn Registry"}}
  CS --> MDB[("Message Store")]
  CS -->|"push"| GW2["Gateway"]
  GW2 -->|"WebSocket"| B(["User B"])`,
    hld: [
      "Clients keep a persistent WebSocket to a gateway server.",
      "A presence service tracks which gateway each user is connected to.",
      "Send: the chat service persists the message, finds the recipient's gateway and pushes it; if the recipient is offline, it waits in storage.",
      "History lives in a wide-column store; media in object storage behind a CDN.",
    ],
    api: ["// over WebSocket", "-> { type: 'msg', conv_id, body, client_msg_id }", "<- { type: 'ack', status: 'delivered', message_id }"],
    lld: [
      "**Connection registry:** user_id to gateway server in Redis, so the system knows where to route.",
      "**Delivery:** push if online, otherwise persist and deliver on reconnect. ACKs move a message from sent to delivered to read.",
      "**Ordering:** per-conversation sequence numbers (or a timestamp plus a tiebreaker).",
      "**Group chat:** fan out to each member's gateway; very large groups behave like feed fan-out.",
      "**Schema:** `messages(conversation_id PK, message_id clustering key, sender, body, ts)`, partitioned by conversation and sorted by time.",
      "**Presence:** heartbeat over the socket, broadcast only to active chats.",
    ],
    stack: [
      { layer: "Transport", pick: "WebSocket", why: "Full-duplex server push; polling cannot do real time cheaply." },
      { layer: "Connection layer", pick: "Gateway fleet + Redis", why: "Holds millions of long-lived connections while the registry routes messages." },
      { layer: "Message store", pick: "Cassandra / HBase", why: "Enormous write volume, time-ordered, partitioned by conversation." },
      { layer: "Presence", pick: "Redis", why: "Fast, short-lived lookups of who is online and where." },
    ],
    tradeoffs: [
      { question: "Which transport?", a: "HTTP long-polling: simple.", b: "WebSocket: true push.", verdict: "WebSocket, falling back to long-polling only where sockets are blocked." },
      { question: "Where to store messages?", a: "Relational database.", b: "Wide-column store (Cassandra).", verdict: "Wide-column: 50B writes a day with simple per-conversation reads is exactly its strength." },
    ],
  },
  {
    slug: "photo-sharing",
    title: "Photo Sharing",
    company: "Instagram",
    difficulty: "medium",
    tags: ["media-upload", "cdn", "pipeline"],
    requirements: {
      functional: ["Upload photos and videos with captions", "Follow users and see their posts in a feed", "View profiles and posts", "Like and comment"],
      nonFunctional: ["Read-heavy; media loads fast worldwide", "Durable storage of originals", "Efficient feed generation"],
    },
    scale: [
      { value: "500M", label: "DAU" },
      { value: "100M", label: "photos / day" },
      { value: "~1,200/s", label: "uploads" },
      { value: "2MB", label: "average photo" },
      { value: "~200TB/day", label: "media" },
    ],
    concepts: [
      { term: "Pre-signed upload", def: "The client uploads straight to object storage, bypassing app servers." },
      { term: "Async media pipeline", def: "Workers create thumbnails and sizes after upload." },
      { term: "Metadata / blob split", def: "The database holds post rows; the bytes live in object storage." },
      { term: "CDN", def: "Immutable media cached at the edge, keyed by content hash." },
    ],
    diagram: `graph LR
  C(["Client"]) -->|"presigned"| OBJ[("Object Storage")]
  C --> APP["App Server"] --> META[("Metadata DB")]
  OBJ --> PIPE["Media Pipeline"]
  PIPE --> OBJ
  C -->|"view"| CDN{{"CDN"}}
  CDN --> OBJ`,
    hld: [
      "Upload: the original goes to object storage, a job creates the sizes, and the post metadata is written.",
      "Feed: the same hybrid fan-out as the News Feed.",
      "Serving: media URLs point at a CDN; metadata comes from the app database.",
    ],
    api: ["POST /media/upload-url -> { presigned_url, media_id }", "POST /posts { media_id, caption } -> { post_id }"],
    lld: [
      "**Split metadata and media:** `post(id, user_id, caption, media_url, created_at)`, with bytes in object storage.",
      "**Image processing:** an async pipeline creates thumbnail, feed and full sizes so clients fetch the right one.",
      "**Direct upload:** give the client a pre-signed URL so large files skip your servers.",
      "**Feed:** reuse the News Feed hybrid push and pull.",
      "**CDN:** media never changes, so cache aggressively by content hash.",
    ],
    stack: [
      { layer: "Media store", pick: "S3 + CDN", why: "Durable, cheap and fast worldwide for immutable media." },
      { layer: "Metadata DB", pick: "Cassandra / sharded SQL", why: "High write volume of small post rows." },
      { layer: "Processing", pick: "Queue + workers", why: "Async resizing keeps uploads fast." },
      { layer: "Feed cache", pick: "Redis", why: "Precomputed timelines for fast opens." },
    ],
    tradeoffs: [
      { question: "How do clients upload?", a: "Through the app servers.", b: "Directly to storage with pre-signed URLs.", verdict: "Directly: large bytes stay off your servers, cutting latency and cost." },
      { question: "When to resize?", a: "On the fly at read time.", b: "At upload time.", verdict: "At upload: reads far outnumber writes, so pay once and serve cached sizes." },
    ],
  },
  {
    slug: "search-autocomplete",
    title: "Search Autocomplete",
    company: "Google search box",
    difficulty: "medium",
    tags: ["trie", "top-k", "debounce"],
    requirements: {
      functional: ["Suggest completions as the user types", "Rank by popularity and relevance", "Respond within a few milliseconds", "Update as trends change"],
      nonFunctional: ["Very low latency on every keystroke", "Huge query volume", "Large, changing vocabulary"],
    },
    scale: [
      { value: "per keystroke", label: "requests" },
      { value: "<50ms", label: "end to end" },
      { value: "top 5-10", label: "suggestions" },
      { value: "billions", label: "queries indexed" },
    ],
    concepts: [
      { term: "Trie (prefix tree)", def: "Maps any prefix to its subtree of completions in O(prefix length)." },
      { term: "Precomputed top-k", def: "Store the best k completions at every node so lookups are instant." },
      { term: "Debouncing", def: "The client waits about 100ms after typing stops before calling." },
      { term: "Prefix sharding", def: "Split the trie by first letters and replicate hot shards." },
    ],
    diagram: `graph LR
  LOGS[("Query Logs")] --> BUILD["Build Pipeline"] --> TRIE{{"Trie + top-k"}}
  C(["Client"]) --> SVC["Suggest Service"] --> TRIE`,
    hld: [
      "An offline pipeline aggregates query logs, computes popularity and builds the suggestion index.",
      "At query time, the suggestion service looks up the prefix and returns the ranked top-k.",
      "Caching at every layer, and the client debounces keystrokes.",
    ],
    api: ["GET /suggest?q=lon -> { suggestions: ['london', 'long', ...] }"],
    lld: [
      "**Trie:** a prefix maps to its completions. Store the **top-k** at each node so a lookup costs O(prefix length) instead of a subtree scan.",
      "**Ranking:** weight by frequency (plus recency and personalization) and rebuild the trie offline from logs.",
      "**Serving:** the trie, or per-prefix top-k, lives in memory for millisecond reads.",
      "**Client:** debounce, cache earlier prefixes, cancel stale requests.",
      "**Scale:** shard the trie by first letters and replicate hot shards.",
      "**Freshness:** periodic rebuilds plus a thin real-time layer for spiking queries.",
    ],
    stack: [
      { layer: "Index", pick: "In-memory trie", why: "Prefix lookups in O(length) with precomputed top-k." },
      { layer: "Build pipeline", pick: "Batch / stream jobs", why: "Aggregate logs offline to rank and rebuild." },
      { layer: "Cache", pick: "Redis / CDN", why: "Popular prefixes are answered instantly." },
    ],
    tradeoffs: [
      { question: "When to compute suggestions?", a: "On the fly per query.", b: "Precomputed top-k per prefix.", verdict: "Precompute: you cannot scan a subtree on every keystroke within 50ms." },
      { question: "How fresh?", a: "Real-time index updates.", b: "Periodic offline rebuilds.", verdict: "Periodic rebuilds plus a thin real-time layer for trends; full real time costs too much." },
    ],
  },
  {
    slug: "nearby-places",
    title: "Nearby Places Service",
    company: "Yelp · Google Maps",
    difficulty: "medium",
    tags: ["geohash", "quadtree", "geo-index"],
    requirements: {
      functional: ["Find places within a radius of a location", "Filter by category", "Rank by distance and rating", "Return results quickly"],
      nonFunctional: ["Low-latency, read-heavy", "Hundreds of millions of places", "Place data changes rarely"],
    },
    scale: [
      { value: "200M", label: "places" },
      { value: "high", label: "read QPS" },
      { value: "<100ms", label: "search" },
      { value: "low", label: "data churn" },
    ],
    concepts: [
      { term: "Geohash", def: "Encodes latitude and longitude as a string; nearby points share a prefix." },
      { term: "QuadTree", def: "Recursively splits space so each leaf holds at most N places, adapting to density." },
      { term: "Geo index", def: "Turns 'within X km' into a bucket lookup instead of a full scan." },
      { term: "Index granularity", def: "Cell size trades precision against how many cells you must scan." },
    ],
    diagram: `graph LR
  C(["Client"]) --> SVC["Search Service"]
  SVC --> CACHE{{"Cache"}}
  SVC --> IDX{{"Geo Index"}}
  IDX --> DB[("Place DB")]`,
    hld: [
      "Places live in a database; a geo index (geohash or quadtree) maps locations to buckets.",
      "The search service finds the cells covering the radius, fetches candidates, filters by exact distance and ranks.",
      "Popular areas are cached, and the index is precomputed because data rarely changes.",
    ],
    api: ["GET /search?lat=..&lng=..&radius=2km&type=cafe -> { places[] }"],
    lld: [
      "**Geohash:** encode latitude and longitude as a string prefix; query the matching prefix plus its 8 neighbor cells to handle boundaries.",
      "**QuadTree:** split space recursively so dense areas get finer cells.",
      "**Search:** compute covering cells, fetch candidates, compute exact distance, filter and rank by distance and rating.",
      "**Granularity:** smaller cells mean fewer candidates per cell but more cells to scan; tune by density.",
      "**Static data:** rebuild the index offline and cache heavily.",
    ],
    stack: [
      { layer: "Geo index", pick: "Redis Geo / Elasticsearch", why: "Built-in geospatial queries with low latency." },
      { layer: "Place DB", pick: "PostgreSQL + PostGIS", why: "Place details with spatial indexing support." },
      { layer: "Cache", pick: "Redis", why: "Busy city-center queries served from memory." },
    ],
    tradeoffs: [
      { question: "Which spatial structure?", a: "Geohash: a simple fixed grid.", b: "QuadTree: adapts to density.", verdict: "QuadTree when density varies a lot (cities vs rural); geohash for simplicity and easy sharding." },
      { question: "How fresh is the index?", a: "Update on every change.", b: "Periodic rebuild plus cache.", verdict: "Periodic rebuild: place data is mostly static, so precompute and cache." },
    ],
  },
  {
    slug: "job-scheduler",
    title: "Distributed Job Scheduler",
    company: "Cron at scale",
    difficulty: "medium",
    tags: ["leader-election", "locks", "idempotent"],
    requirements: {
      functional: ["Schedule one-time and recurring jobs", "Run each job at the right time", "Retry on failure", "Spread execution across many workers"],
      nonFunctional: ["Reliable: no missed or duplicated runs", "Scalable and fault-tolerant", "Effectively-once execution", "Survives node failure"],
    },
    scale: [
      { value: "millions", label: "scheduled jobs" },
      { value: "1", label: "active dispatcher" },
      { value: "backoff", label: "retries" },
      { value: "minute", label: "time buckets" },
    ],
    concepts: [
      { term: "Leader election", def: "Only one dispatcher is active at a time (via ZooKeeper or etcd) to avoid duplicate dispatch." },
      { term: "Atomic claim", def: "UPDATE ... WHERE status='pending' lets exactly one worker claim a job." },
      { term: "Idempotent execution", def: "An execution id makes a retried job safe to run again." },
      { term: "Timing wheel", def: "A ring of time buckets for efficient high-precision scheduling." },
    ],
    diagram: `graph LR
  API(["Schedule Job"]) --> JDB[("Job Store")]
  ZK[["Leader Election"]] --> DISP["Dispatcher"]
  DISP --> JDB
  DISP --> Q[["Queue"]] --> W["Workers"]
  W --> JDB`,
    hld: [
      "Jobs are stored in a database indexed by next_run_at.",
      "A dispatcher finds due jobs and enqueues them; leader election keeps one dispatcher active.",
      "A worker pool pulls jobs from the queue and runs them.",
      "Status and retries are tracked, and recurring jobs reschedule themselves.",
    ],
    api: ["POST /jobs { run_at | cron, task, payload } -> { job_id }", "// worker: claim -> execute -> ack or retry"],
    lld: [
      "**Due query:** `SELECT * FROM jobs WHERE next_run_at <= now()`, then push the results to a queue.",
      "**No duplicate dispatch:** leader election (one dispatcher) or an atomic claim (`UPDATE ... WHERE status='pending'`).",
      "**Idempotent execution:** workers record running and done with an execution id so retries do not repeat side effects.",
      "**Retries:** failed jobs are re-queued with exponential backoff; after the maximum attempts they go to a dead-letter queue.",
      "**Recurring jobs:** after a run, compute the next next_run_at from the cron expression.",
      "**Precision:** bucket by minute at scale, or use a timing wheel for high precision.",
    ],
    stack: [
      { layer: "Job store", pick: "PostgreSQL", why: "Indexed by next_run_at, with atomic claims through row updates." },
      { layer: "Dispatch", pick: "Kafka / SQS", why: "Hands due jobs to a scalable worker pool." },
      { layer: "Coordination", pick: "ZooKeeper / etcd", why: "Leader election and distributed locks prevent duplicate dispatch." },
      { layer: "Workers", pick: "Stateless fleet", why: "Scale out; idempotent execution tolerates retries." },
    ],
    tradeoffs: [
      { question: "How to find due jobs?", a: "Poll the database.", b: "An in-memory timing wheel.", verdict: "Polling for scale and simplicity (a small delay is fine); a timing wheel for high precision." },
      { question: "Execution guarantee?", a: "Exactly-once: hard and costly.", b: "At-least-once plus idempotency.", verdict: "At-least-once with idempotent tasks: exactly-once across failures is close to impossible, so make re-runs safe." },
    ],
  },
  {
    slug: "video-streaming",
    title: "Video Streaming",
    company: "YouTube · Netflix",
    difficulty: "hard",
    tags: ["transcoding", "adaptive-bitrate", "cdn"],
    requirements: {
      functional: ["Upload and store video", "Stream smoothly at varying quality", "Search and recommendations", "Track views and likes"],
      nonFunctional: ["Massive storage and egress bandwidth", "Smooth playback across devices and networks", "Low latency worldwide", "Durable and highly available"],
    },
    scale: [
      { value: "2B", label: "users" },
      { value: "500 hrs", label: "uploaded / min" },
      { value: "~1B hrs", label: "watched / day" },
      { value: "petabytes", label: "storage" },
      { value: "huge", label: "CDN egress" },
    ],
    concepts: [
      { term: "Transcoding", def: "Converting video into many resolutions and codecs, in parallel per segment." },
      { term: "Adaptive bitrate (HLS/DASH)", def: "Chunks at several qualities; the player switches by live bandwidth, so it does not buffer." },
      { term: "CDN", def: "Edge caches serve most bytes close to viewers." },
      { term: "Storage tiering", def: "Popular videos on fast storage, old ones on cheap archival storage." },
    ],
    diagram: `graph LR
  C(["Upload"]) --> RAW[("Raw Storage")]
  RAW --> TR["Transcoding Pipeline"] --> CHUNKS[("Chunk Storage")]
  CHUNKS --> CDN{{"CDN"}}
  V(["Viewer"]) --> CDN
  V --> META["Metadata Service"]`,
    hld: [
      "Uploads go to object storage, then a transcoding pipeline produces resolutions and chunks.",
      "Chunks and manifests are distributed to a CDN; players fetch the manifest, then stream chunks.",
      "A metadata service holds video info; search and recommendations index the content.",
      "Views and analytics flow through a streaming pipeline.",
    ],
    api: ["POST /videos/upload-url -> { presigned_url, video_id }", "GET  /videos/{id}/manifest.m3u8 -> HLS manifest"],
    lld: [
      "**Transcoding:** split the file into segments and process them in parallel into several bitrates and codecs (a DAG of tasks). This is the heavy, expensive part.",
      "**Adaptive bitrate (HLS/DASH):** 2-10 second chunks at several qualities, listed in a manifest; the player switches quality by bandwidth.",
      "**Storage tiers:** popular videos near the CDN, cold videos on cheap archival storage.",
      "**The CDN does most of the work:** edges serve nearly all traffic and the origin only handles misses.",
      "**View counts:** aggregate through a stream processor and write in batches, never one database update per view.",
    ],
    stack: [
      { layer: "Storage", pick: "S3 + tiers", why: "Petabyte-scale durable storage with hot and cold tiers." },
      { layer: "Transcoding", pick: "Distributed pipeline", why: "Parallel, per-segment processing into many formats." },
      { layer: "Delivery", pick: "CDN (HLS/DASH)", why: "Chunked adaptive streaming from the edge is the practical way to serve video worldwide." },
      { layer: "Metadata", pick: "Sharded SQL / NoSQL", why: "Video info, channels and relationships." },
      { layer: "Analytics", pick: "Kafka + stream processing", why: "Aggregates views without hammering the database." },
    ],
    tradeoffs: [
      { question: "How to deliver video?", a: "Whole files from the origin.", b: "Chunked adaptive bitrate from a CDN.", verdict: "Chunked ABR from a CDN: it copes with variable networks and the CDN absorbs the egress." },
      { question: "When to transcode?", a: "On demand at first view.", b: "Eagerly at upload.", verdict: "Eagerly: playback must start instantly. Transcode only rare formats lazily." },
    ],
  },
  {
    slug: "ride-hailing",
    title: "Ride-Hailing",
    company: "Uber · Lyft",
    difficulty: "hard",
    tags: ["geospatial", "matching", "in-memory"],
    requirements: {
      functional: ["Riders request a ride and are matched with a nearby driver", "Track driver and rider location in real time", "Show ETA and fare estimate", "Manage the ride lifecycle"],
      nonFunctional: ["Low-latency matching", "Very high volume of location writes", "Handle dense city hot spots", "Exactly one driver per ride"],
    },
    scale: [
      { value: "5M", label: "active drivers" },
      { value: "every 4s", label: "location ping" },
      { value: "1M+/s", label: "location writes" },
      { value: "sub-second", label: "matching" },
    ],
    concepts: [
      { term: "Geohash / QuadTree", def: "A spatial index so 'nearby drivers' is a bucket lookup, not a scan." },
      { term: "In-memory geo store", def: "Live locations in Redis; short-lived pings never touch disk." },
      { term: "Atomic assignment", def: "A conditional update guarantees one driver is assigned to one rider." },
      { term: "Hot partitions", def: "Dense city centers overload a cell, so use finer cells there." },
    ],
    diagram: `graph LR
  D(["Driver"]) -->|"location"| LOC["Location Service"]
  LOC --> GEO{{"Geo Index"}}
  R(["Rider"]) --> M["Matching Service"]
  M --> GEO
  M --> TRIP[("Trip Store")]`,
    hld: [
      "Drivers send location pings to a location service that updates an in-memory geo index.",
      "A ride request goes to the matching service, which queries nearby available drivers, ranks them and makes an offer.",
      "A trip service manages ride state; payments and notifications run downstream.",
      "Maps and ETA come from a routing service.",
    ],
    api: ["POST /rides { pickup, dropoff } -> { ride_id, driver, eta }", "POST /drivers/{id}/location { lat, lng } -> 200"],
    lld: [
      "**Geo index:** a QuadTree or geohash makes 'drivers within X km' fast; geohash buckets by string prefix and shards easily.",
      "**Location updates:** drivers ping every few seconds, so current locations live in Redis Geo, not on disk.",
      "**Matching:** query candidates, filter by availability and rating, offer to the best; an atomic update stops two riders from taking the same driver.",
      "**Hot spots:** finer cells where density is high.",
      "**Ride state machine:** requested, accepted, arrived, in progress, completed, persisted durably.",
    ],
    stack: [
      { layer: "Geo index", pick: "Redis Geo / QuadTree", why: "In-memory proximity search handles the ping volume and sub-second queries." },
      { layer: "Matching", pick: "Dedicated service", why: "Low-latency, atomic driver assignment." },
      { layer: "Trip state", pick: "SQL", why: "One driver per ride, valid transitions and payment integrity need consistency." },
      { layer: "Streaming", pick: "Kafka", why: "Location and trip events feed analytics, pricing and ETAs." },
    ],
    tradeoffs: [
      { question: "Which spatial structure?", a: "Geohash: simple prefixes.", b: "QuadTree: adapts to density.", verdict: "QuadTree when density varies a lot; geohash for simpler sharding. Both beat scanning by distance." },
      { question: "Where do live locations go?", a: "An on-disk database.", b: "In memory (Redis).", verdict: "In memory: millions of writes per second of data that is useless once stale." },
    ],
  },
  {
    slug: "file-sync",
    title: "File Storage & Sync",
    company: "Dropbox · Google Drive",
    difficulty: "hard",
    tags: ["chunking", "dedup", "delta-sync"],
    requirements: {
      functional: ["Upload, download and sync files across devices", "Share files and folders", "Version history", "Resolve conflicting edits"],
      nonFunctional: ["Durable: never lose data", "Efficient sync of only the changed parts", "Large files", "Consistent metadata across devices"],
    },
    scale: [
      { value: "100s of M", label: "users" },
      { value: "exabytes", label: "stored" },
      { value: "KB to GB", label: "file sizes" },
      { value: "chunk", label: "sync unit" },
    ],
    concepts: [
      { term: "Chunking", def: "Split files into blocks so only changed blocks are uploaded." },
      { term: "Content-addressed dedup", def: "Store each chunk once, by its hash, and reuse it across users and versions." },
      { term: "Delta sync", def: "Send only the chunks a device is missing." },
      { term: "Version vectors", def: "Detect real conflicts across devices instead of overwriting." },
    ],
    diagram: `graph LR
  AG(["Client Agent"]) --> META[("Metadata DB")]
  AG -->|"chunks"| OBJ[("Chunk Store")]
  META --> SYNC["Sync Service"]
  SYNC -->|"changeset"| AG2(["Other Device"])`,
    hld: [
      "A client agent watches the local folder and syncs changes.",
      "Files are split into chunks and only changed chunks are uploaded to object storage.",
      "A metadata service tracks files, chunk lists, versions and device state.",
      "A sync service tells other devices what changed so they pull updates.",
    ],
    api: ["POST /files/{id}/chunks { hash, data } -> 200 (skipped if the hash exists)", "GET  /files/{id}/changes?since=v -> { changeset }"],
    lld: [
      "**Chunking:** fixed or content-defined blocks of about 4MB. A small edit to a big file uploads only the changed chunks.",
      "**Dedup:** hash each chunk; if the hash already exists, store a reference instead of uploading again.",
      "**Metadata:** `file(id, name, version, chunk_hashes[], owner)`, with chunks stored by hash.",
      "**Sync:** clients receive a changeset and download only the chunk hashes they lack.",
      "**Conflicts:** detect with version vectors and keep both copies on a real conflict, never silently losing data.",
      "**Consistency:** metadata is the strongly consistent source of truth; chunk storage can be eventually consistent.",
    ],
    stack: [
      { layer: "Chunk store", pick: "S3", why: "Durable and cheap, addressed by hash for dedup." },
      { layer: "Metadata DB", pick: "Strongly consistent SQL", why: "The file, version and chunk mapping must be correct and transactional." },
      { layer: "Sync notify", pick: "Long-poll / WebSocket", why: "Pushes change notifications so devices update promptly." },
      { layer: "Cache", pick: "Redis", why: "Hot metadata and chunk-existence checks." },
    ],
    tradeoffs: [
      { question: "Upload granularity?", a: "The whole file on each change.", b: "Only changed chunks.", verdict: "Chunks: editing one line of a 1GB file should upload kilobytes, not a gigabyte." },
      { question: "Metadata consistency?", a: "Eventual: easier to scale.", b: "Strong: one source of truth.", verdict: "Strong for metadata so file lists are never wrong; eventual is fine for chunk bytes." },
    ],
  },
  {
    slug: "ticket-booking",
    title: "Ticket Booking",
    company: "Ticketmaster · BookMyShow",
    difficulty: "hard",
    tags: ["locking", "reservation", "idempotency"],
    requirements: {
      functional: ["Browse events and available seats", "Reserve a seat, then pay within a time limit", "Confirm the booking and issue a ticket", "Release seats from unpaid holds"],
      nonFunctional: ["No double-booking (strong consistency)", "Survive massive on-sale spikes", "Fair access under contention", "Read-heavy browsing, write-contended booking"],
    },
    scale: [
      { value: "spiky", label: "on-sale surges" },
      { value: "10k+/s", label: "peak seat grabs" },
      { value: "1 seat", label: "exactly 1 buyer" },
      { value: "~10 min", label: "hold time" },
    ],
    concepts: [
      { term: "Pessimistic locking", def: "Lock the seat row during reservation so nobody else can take it." },
      { term: "Reservation TTL", def: "A time-limited hold that releases itself if payment does not finish." },
      { term: "Idempotency", def: "Keys stop a retried payment from double-charging or double-booking." },
      { term: "CAP: choose consistency", def: "For inventory, correctness beats availability during a partition." },
    ],
    diagram: `graph LR
  C(["Client"]) --> WR[["Waiting Room"]] --> RES["Reservation Service"]
  RES --> INV[("Inventory DB")]
  RES --> HOLD{{"Seat Holds TTL"}}
  C -->|"browse"| CACHE{{"Cache"}}
  CACHE --> INV`,
    hld: [
      "Browsing events and seat maps is read-heavy and served from cache and CDN.",
      "Booking runs in three steps: reserve (temporary hold), pay, confirm.",
      "A reservation service backed by a strongly consistent store guards inventory.",
      "A virtual waiting room throttles on-sale spikes.",
    ],
    api: ["POST /events/{id}/reserve { seat_ids } -> { reservation_id, expires_at }", "POST /reservations/{id}/confirm { payment_token, idem_key } -> { booking }"],
    lld: [
      "**Seat states:** AVAILABLE, RESERVED (held with a TTL), BOOKED.",
      "**No double-booking:** a transaction with row locks or an atomic compare-and-set, `UPDATE seat SET state='RESERVED' WHERE id=? AND state='AVAILABLE'`, so only one writer wins.",
      "**Expiry:** holds have a TTL; a job or TTL key releases unpaid seats.",
      "**Idempotency:** payment and booking use keys so retries never double-charge or double-book.",
      "**On-sale spikes:** a virtual waiting room admits users in batches so the database is not stampeded.",
      "**Consistency first:** for inventory, be correct even if it costs some latency.",
    ],
    stack: [
      { layer: "Inventory DB", pick: "PostgreSQL (ACID)", why: "Row locks and transactions guarantee no double-booking." },
      { layer: "Holds", pick: "Redis with TTL", why: "Fast seat holds that expire on abandoned checkouts." },
      { layer: "Waiting room", pick: "Queue + admission token", why: "Turns an on-sale stampede into a steady admission rate." },
      { layer: "Browse cache", pick: "Redis + CDN", why: "Seat maps and event pages are read-heavy and change slowly." },
    ],
    tradeoffs: [
      { question: "CAP choice for inventory?", a: "Availability: accept now, reconcile later.", b: "Consistency: reject during a partition.", verdict: "Consistency: selling one seat twice is unacceptable." },
      { question: "How to hold a seat?", a: "Optimistic: claim it at payment time.", b: "Reservation with a TTL.", verdict: "Reservation with a TTL: the buyer gets time to pay without locking the seat forever." },
    ],
  },
  {
    slug: "distributed-cache",
    title: "Distributed Cache",
    company: "Redis-like infrastructure",
    difficulty: "hard",
    tags: ["consistent-hashing", "lru", "replication"],
    requirements: {
      functional: ["GET, SET and DELETE key-value pairs", "TTL expiry", "Spread data across many nodes", "Replicate for availability"],
      nonFunctional: ["Sub-millisecond latency", "Scale by adding nodes", "Minimal data movement when nodes join or leave", "Tolerate node failures"],
    },
    scale: [
      { value: "TBs", label: "in memory" },
      { value: "<1ms", label: "GET / SET" },
      { value: "100s", label: "nodes" },
      { value: "RF 2-3", label: "replicas" },
    ],
    concepts: [
      { term: "Consistent hashing", def: "Keys and nodes sit on a ring; adding a node remaps only about 1/N of keys." },
      { term: "Virtual nodes", def: "Many ring positions per node for even load and smooth rebalancing." },
      { term: "LRU / LFU eviction", def: "Drop the least recently or least frequently used keys when memory is full." },
      { term: "Gossip", def: "Decentralized heartbeats detect failed nodes." },
    ],
    diagram: `graph LR
  C(["Client"]) --> RING{{"Hash Ring"}}
  RING --> N1[("Node 1")]
  RING --> N2[("Node 2")]
  RING --> N3[("Node 3")]
  N1 -->|"replicate"| N2`,
    hld: [
      "Clients hash a key to find the responsible node, either in a client library or through a proxy.",
      "Each node holds a shard in memory with an eviction policy.",
      "Replicas hold copies for failover, and a gossip layer tracks which nodes are alive.",
      "Keys and nodes are placed on a consistent-hashing ring.",
    ],
    api: ["GET key -> value | nil", "SET key value EX ttl -> OK"],
    lld: [
      "**Consistent hashing:** a key belongs to the next node clockwise. Adding or removing a node remaps one arc, while `hash % N` reshuffles nearly everything.",
      "**Virtual nodes:** many ring positions per physical node for an even spread.",
      "**Eviction:** LRU by default; LFU for workloads skewed by frequency.",
      "**Replication:** each shard has replicas; writes go to the primary and propagate. Synchronous is safe and slower, asynchronous is fast and can lose recent writes.",
      "**Failure detection:** gossip and heartbeats; when a node dies, promote a replica and remap its arc.",
      "**Hot keys:** replicate the hot key or add a small client-side cache.",
    ],
    stack: [
      { layer: "Store", pick: "In-memory per node", why: "Sub-millisecond reads and writes are the point of a cache." },
      { layer: "Distribution", pick: "Consistent hashing", why: "Add nodes with minimal key movement." },
      { layer: "Replication", pick: "Primary + replicas", why: "Lose a node without losing its shard." },
      { layer: "Membership", pick: "Gossip protocol", why: "Decentralized liveness tracking across hundreds of nodes." },
    ],
    tradeoffs: [
      { question: "How to partition?", a: "Modulo hashing (hash % N).", b: "Consistent hashing with virtual nodes.", verdict: "Consistent hashing: a new node remaps about 1/N of keys instead of nearly all of them." },
      { question: "Replication mode?", a: "Synchronous: no loss, slower.", b: "Asynchronous: fast, may lose recent writes.", verdict: "Asynchronous for a cache, since data can be rebuilt from the source of truth; synchronous only if the cache is authoritative." },
    ],
  },
  {
    slug: "message-queue",
    title: "Distributed Message Queue",
    company: "Kafka · Pulsar",
    difficulty: "hard",
    tags: ["partitioning", "offsets", "append-log"],
    requirements: {
      functional: ["Producers publish to topics and consumers subscribe", "Durable and ordered within a partition", "Replay from any offset", "Horizontal scaling"],
      nonFunctional: ["Very high throughput", "Durable and fault-tolerant", "At-least-once or exactly-once delivery", "Low latency"],
    },
    scale: [
      { value: "millions/s", label: "messages" },
      { value: "TBs", label: "retained" },
      { value: "append-only", label: "log on disk" },
      { value: "RF 3", label: "replicas" },
    ],
    concepts: [
      { term: "Partitioning", def: "A topic splits into partitions; hashing the key to a partition gives per-key order and parallelism." },
      { term: "Append-only log", def: "Messages are appended sequentially to disk, and sequential IO is very fast." },
      { term: "Offsets and consumer groups", def: "Each partition is read by one consumer per group, which commits an offset." },
      { term: "ISR replication", def: "In-sync replicas: the leader acknowledges after replicating, for durability." },
    ],
    diagram: `graph LR
  P(["Producers"]) --> B["Brokers"]
  B --> P0[("Partition 0")]
  B --> P1[("Partition 1")]
  P0 --> CG["Consumer Group"]
  P1 --> CG
  META[["KRaft Metadata"]] --> B`,
    hld: [
      "Producers publish to partitioned topics hosted on brokers.",
      "Each partition is an append-only log on disk, and each message is identified by its offset.",
      "Consumer groups read partitions and commit offsets.",
      "Partitions are replicated across brokers, and a consensus layer (ZooKeeper or KRaft) handles leader election.",
    ],
    api: ["produce(topic, key, value) -> offset", "poll(group, topic) -> records, then commit(offset)"],
    lld: [
      "**Partitions:** the producer's key hashes to a partition. Order is guaranteed only within a partition.",
      "**Append-only log:** each partition appends to disk in segments; sequential writes are why it is so fast.",
      "**Consumer groups:** each partition is consumed by exactly one consumer in a group, so more partitions means more parallelism.",
      "**Offsets:** consumers commit offsets, so they can replay or resume after a crash.",
      "**Replication:** each partition has a leader and followers (the ISR); the leader acknowledges after in-sync replication.",
      "**Delivery:** at-least-once by default; exactly-once with an idempotent producer and transactions.",
    ],
    stack: [
      { layer: "Brokers", pick: "Kafka / Pulsar", why: "Partitioned append-only logs with sequential disk IO at very high throughput." },
      { layer: "Metadata", pick: "ZooKeeper / KRaft", why: "Cluster membership and partition leader election." },
      { layer: "Storage", pick: "Local disk segments", why: "Durable retention by time or size with cheap sequential writes." },
    ],
    tradeoffs: [
      { question: "Push or pull?", a: "Brokers push to consumers.", b: "Consumers pull at their own pace.", verdict: "Pull: consumers control their rate, avoid overload and can batch." },
      { question: "Ordering or parallelism?", a: "One partition for global order.", b: "Many partitions for parallelism.", verdict: "Partition by key: per-key order plus horizontal scale. Global order is rarely needed." },
    ],
  },
  {
    slug: "collaborative-editor",
    title: "Collaborative Editor",
    company: "Google Docs · Notion",
    difficulty: "hard",
    tags: ["ot", "crdt", "websocket"],
    requirements: {
      functional: ["Many users edit one document at the same time", "Everyone sees changes live", "Live cursors and presence", "Edit history"],
      nonFunctional: ["Low-latency sync", "All users converge to the same document", "Consistent and available", "Offline edits where possible"],
    },
    scale: [
      { value: "many", label: "concurrent editors" },
      { value: "ms", label: "sync latency" },
      { value: "op log", label: "persistence" },
      { value: "snapshots", label: "for fast load" },
    ],
    concepts: [
      { term: "Operational Transformation (OT)", def: "Transforms concurrent operations so they converge in any order; Google Docs uses it with a central server." },
      { term: "CRDT", def: "Data types that merge automatically without central coordination, good for offline and peer-to-peer." },
      { term: "WebSocket", def: "A low-latency two-way channel for streaming edits." },
      { term: "Op log and snapshots", def: "Store operations plus periodic snapshots for history and fast loading." },
    ],
    diagram: `graph LR
  A(["User A"]) -->|"WebSocket"| CS["Collab Server"]
  B(["User B"]) -->|"WebSocket"| CS
  CS --> OT["OT / CRDT Engine"]
  CS --> LOG[("Op Log + Snapshots")]`,
    hld: [
      "Clients connect over WebSocket to the collaboration server that owns the document (sticky routing).",
      "The server orders incoming operations, transforms and applies them, then broadcasts to all clients.",
      "A presence channel streams cursors; storage keeps the op log and periodic snapshots.",
    ],
    api: ["// over WebSocket", "-> { op: 'insert', pos: 42, char: 'x', rev: 7 }", "<- { op, rev: 8 } broadcast to all editors"],
    lld: [
      "**Operation model:** each edit is an operation (insert or delete at a position), not a whole-document save.",
      "**OT:** a central server assigns a global order and transforms concurrent operations so every client converges.",
      "**CRDT (alternative):** every character gets a unique id so merges commute; no central ordering, better offline support, more metadata and memory.",
      "**Persistence:** append operations to a log and snapshot periodically so opening a document does not replay millions of operations.",
      "**Presence and cursors:** short-lived messages that are never persisted.",
      "**Sticky routing:** all editors of a document reach the same server so its in-memory state is authoritative.",
    ],
    stack: [
      { layer: "Transport", pick: "WebSocket", why: "Millisecond delivery of fine-grained edits." },
      { layer: "Collab server", pick: "In-memory doc + sticky routing", why: "Owns live document state and orders and transforms operations." },
      { layer: "Persistence", pick: "Op log + snapshot store", why: "History, recovery and fast document loading." },
      { layer: "Presence", pick: "Redis pub/sub", why: "Live cursors without durable storage." },
    ],
    tradeoffs: [
      { question: "Which convergence algorithm?", a: "OT: central server, mature.", b: "CRDT: decentralized, offline-friendly.", verdict: "OT for a classic server-backed editor; CRDT when you need offline or peer-to-peer editing." },
      { question: "How to resolve conflicts?", a: "Last write wins: simple, loses edits.", b: "OT or CRDT: preserves intent.", verdict: "OT or CRDT: a text editor must never silently drop someone's keystrokes." },
    ],
  },
  {
    slug: "payment-system",
    title: "Payment System",
    company: "Stripe · PayPal",
    difficulty: "hard",
    tags: ["ledger", "idempotency", "saga"],
    requirements: {
      functional: ["Charge a customer and pay a merchant", "Maintain balances and wallets", "Refunds and disputes", "Integrate external processors"],
      nonFunctional: ["Never lose or duplicate money", "Strong consistency and auditability", "Idempotent operations", "High availability and compliance"],
    },
    scale: [
      { value: "exact", label: "money, no approximation" },
      { value: "idempotent", label: "every write" },
      { value: "full", label: "audit trail" },
      { value: "ACID", label: "required" },
    ],
    concepts: [
      { term: "Double-entry ledger", def: "Every transaction writes balanced debit and credit rows; balances are derived, never edited." },
      { term: "Idempotency keys", def: "One key per payment intent, so a retry returns the same result instead of charging twice." },
      { term: "Saga pattern", def: "Multi-service flows with compensating actions instead of a distributed transaction." },
      { term: "Reconciliation", def: "Compare internal records with the processor's statements to catch mismatches." },
    ],
    diagram: `graph LR
  C(["Client"]) -->|"idem key"| PS["Payment Service"]
  PS --> LED[("Ledger")]
  PS --> SAGA[["Saga Orchestrator"]]
  SAGA --> PROC{{"Processor"}}
  PROC -->|"webhook"| PS
  REC["Reconciliation"] --> LED`,
    hld: [
      "A payment service runs the flow: validate, reserve, call the processor, record the result.",
      "A ledger service records every movement as immutable double-entry rows.",
      "External processors sit behind an adapter, with results arriving synchronously or by webhook.",
      "A daily reconciliation job compares internal records with processor statements.",
    ],
    api: ["POST /payments { amount, source, dest, idem_key } -> { status }", "POST /refunds { payment_id, amount, idem_key } -> { status }"],
    lld: [
      "**Double-entry ledger:** balanced debit and credit rows per transaction; balances are derived and debits must equal credits, so the system is auditable and self-checking.",
      "**Idempotency keys:** the client sends a unique key and the server returns the stored result on retries, so there is no double charge.",
      "**Saga:** a payment spans several services and processors, so use compensating actions (such as a refund when a later step fails) instead of one database transaction.",
      "**State machine:** created, authorized, captured, settled, or failed and refunded, with every transition recorded.",
      "**Consistency:** ACID storage, and reject rather than guess when unsure.",
      "**Reconciliation:** never fully trust a single call; reconcile against the processor's records.",
    ],
    stack: [
      { layer: "Ledger DB", pick: "PostgreSQL (ACID)", why: "Money needs transactions, constraints and durability." },
      { layer: "Idempotency", pick: "Key store", why: "Dedupes retried requests so a flaky network cannot double-charge." },
      { layer: "Orchestration", pick: "Saga / workflow engine", why: "Coordinates multi-step flows with compensations." },
      { layer: "Processors", pick: "External APIs + webhooks", why: "Card networks and banks behind an adapter, with async results." },
    ],
    tradeoffs: [
      { question: "Consistency model?", a: "Eventual: faster.", b: "Strong / ACID.", verdict: "Strong: for money, correctness and auditability come before latency." },
      { question: "Transactions across services?", a: "Two-phase commit (2PC).", b: "Saga with compensations.", verdict: "Saga: 2PC holds locks and scales poorly across services; sagas stay available and undo cleanly." },
    ],
  },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};
