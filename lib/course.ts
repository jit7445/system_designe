export const TRACK_DIAGRAMS = {
  start: `graph LR
  R(["Requirements"]) --> E["Estimate"]
  E --> A[["API"]]
  A --> H["HLD"]
  H --> L{{"LLD"}}
  L --> T[("Trade-offs")]`,
  fundamentals: `graph LR
  C(["Client"]) --> DNS{{"DNS"}}
  C --> LB["Load Balancer"]
  LB --> S1["App"]
  LB --> S2["App"]
  S1 --> K{{"Cache"}}
  S2 --> K
  K --> DB[("Database")]`,
  hld: `graph LR
  A(["User A"]) --> GW["Gateway"]
  GW --> CS["Chat Service"]
  CS --> Q[["Queue"]]
  CS --> DB[("Messages")]
  Q --> GW2["Gateway"]
  GW2 --> B(["User B"])`,
  lld: `classDiagram
  class ParkingLot {
    +park(Vehicle v) Ticket
  }
  class Floor
  class Spot
  class Vehicle
  ParkingLot "1" *-- "many" Floor
  Floor "1" *-- "many" Spot
  Spot --> Vehicle`,
  advanced: `graph LR
  C(["Client"]) --> L["Leader"]
  L --> F1["Follower"]
  L --> F2["Follower"]
  L --> LOG[("Replicated Log")]
  F1 --> LOG
  F2 --> LOG`,
} as const;

export const PHASES = [
  { weeks: "Weeks 1-2", title: "Fundamentals", items: ["Client-server, DNS, HTTP, TCP vs UDP", "Latency numbers you should know", "SQL vs NoSQL data models", "ACID vs BASE, the CAP theorem"] },
  { weeks: "Weeks 3-4", title: "Building blocks", items: ["Load balancers (L4 vs L7)", "Caching strategies and CDNs", "Replication, sharding, partitioning", "Message queues and pub/sub"] },
  { weeks: "Weeks 5-6", title: "Patterns and scale", items: ["Consistent hashing", "Rate limiting and idempotency", "Fan-out and event-driven design", "Logs, metrics, tracing"] },
  { weeks: "Weeks 7-8", title: "Practice and mocks", items: ["Work the 20 questions timed", "3-4 mock interviews out loud", "Re-draw old designs from memory", "Prepare your own project as a case study"] },
];

export const FRAMEWORK = [
  { step: "Step 1", minutes: "~5 min", title: "Clarify requirements", body: "Split functional (what it does) from non-functional (scale, latency, consistency, availability). Say what you will not build. Never draw before this." },
  { step: "Step 2", minutes: "~5 min", title: "Estimate the scale", body: "Back-of-the-envelope: DAU, reads/s, writes/s, storage per year, bandwidth. These numbers drive every later choice." },
  { step: "Step 3", minutes: "~5 min", title: "API and data model", body: "List the core endpoints with inputs and outputs, then the main entities and keys. This anchors the design." },
  { step: "Step 4", minutes: "~10 min", title: "High-level design (HLD)", body: "Boxes and arrows: clients, load balancer, services, caches, databases, queues. Walk the read path and the write path end to end." },
  { step: "Step 5", minutes: "~12 min", title: "Deep dive (LLD)", body: "Pick the one or two hardest parts and go deep: schema, algorithms, shard key, queue design, edge cases." },
  { step: "Step 6", minutes: "~5 min", title: "Bottlenecks and trade-offs", body: "Name single points of failure, hot spots and consistency gaps. Propose fixes, justify each trade-off, and restate how the design meets the requirements." },
];

export const CORE_CONCEPTS = [
  { term: "CAP theorem", def: "During a network partition you choose consistency or availability. Most systems pick availability with eventual consistency; money and inventory pick consistency." },
  { term: "Consistency models", def: "Strong (always the latest value) vs eventual (converges soon). Weaker consistency buys caching, replication and speed." },
  { term: "Horizontal vs vertical scaling", def: "More machines (scale out) vs a bigger machine (scale up). Large systems scale out, which needs stateless services and sharding." },
  { term: "Load balancing", def: "Spread traffic across servers. L4 routes by IP and port (fast), L7 by HTTP content (smarter)." },
  { term: "Caching", def: "Keep hot data in memory (cache-aside, write-through). Cuts latency and database load; invalidation is the hard part." },
  { term: "CDN", def: "Edge servers cache static and immutable content close to users. Essential for images, video and global latency." },
  { term: "Database sharding", def: "Partition data across nodes by a shard key. Scales writes and storage; a bad key creates hot spots." },
  { term: "Replication", def: "Copies for availability and read scaling. Synchronous is safe but slow; asynchronous is fast but can lose recent writes." },
  { term: "Consistent hashing", def: "Keys and nodes on a ring, so adding or removing a node remaps only about 1/N of keys." },
  { term: "Message queues", def: "Decouple producers from consumers (Kafka, SQS). Absorb bursts and enable async work, retries and replay." },
  { term: "Idempotency", def: "Applying the same request twice gives the same result. With unique keys, retries become safe." },
  { term: "Indexing", def: "A structure (B-tree, inverted index, trie) that turns a scan into a lookup, at the cost of storage and slower writes." },
];

export const LESSON_PARTS = [
  { title: "Requirements", body: "Functional and non-functional requirements, the way you would clarify them with an interviewer." },
  { title: "Scale", body: "Back-of-the-envelope numbers: traffic, storage and the ratios that shape the design." },
  { title: "Concepts", body: "The handful of ideas the design depends on, defined in one or two lines each." },
  { title: "HLD", body: "A color-coded architecture diagram plus the read and write paths, with an API sketch." },
  { title: "LLD", body: "The deep dive: schemas, algorithms, keys and the edge cases interviewers probe." },
  { title: "Tech stack", body: "What to use at each layer and why it fits this workload." },
  { title: "Trade-offs", body: "Two real options for each key decision and which one to pick." },
];

export const FAQ = [
  { q: "Do I need distributed systems experience first?", a: "No. Start with the Getting Started module and the core concepts. The easy questions only need databases, caching and HTTP basics." },
  { q: "In what order should I do the questions?", a: "Follow the sidebar from top to bottom. Modules go from simpler storage problems to real-time, search, media and transactional systems." },
  { q: "How should I practice a question?", a: "Set a 40-minute timer and design it on paper using the six-step framework before opening the lesson. Then compare and note the gaps." },
  { q: "Where is my progress saved?", a: "In this browser's local storage. It stays on this device and is never sent anywhere." },
  { q: "Are these the only correct designs?", a: "No. They are solid reference designs. Interviewers care more about how you reason through trade-offs than about matching one architecture." },
];
