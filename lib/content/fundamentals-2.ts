import type { Article } from "../types";

export const FUNDAMENTALS_DATA: Article[] = [
  {
    slug: "scalability-and-estimation",
    title: "Scalability and Back-of-the-Envelope Estimation",
    level: "basic",
    summary: "How systems grow from one server to many, and how to size them quickly with rough numbers before you draw a single box.",
    tags: ["scaling", "estimation", "capacity"],
    sections: [
      {
        id: "what-scalability-means",
        heading: "What scalability actually means",
        blocks: [
          { type: "p", text: "A system is scalable when it can handle more load by adding resources, without a redesign and without performance falling off a cliff. Load can mean requests per second, the amount of data stored, the number of concurrent connections, or the fan-out of a single operation. In an interview, always say **which** load you are scaling for, because a system that handles 1 million users browsing is very different from one that handles 1 million users each uploading video." },
          { type: "p", text: "There are two basic ways to add resources. **Vertical scaling** (scale up) means a bigger machine: more CPU cores, more RAM, faster disks. **Horizontal scaling** (scale out) means more machines sharing the work behind a load balancer. Most real systems do both: they scale up until the price or hardware limit makes it painful, then scale out." },
          {
            type: "cards",
            items: [
              { title: "Vertical scaling", text: "Zero code changes, no distributed-systems problems, strong consistency for free. But there is a hard ceiling, cost grows faster than capacity at the top end, and one machine is one failure domain." },
              { title: "Horizontal scaling", text: "Near-linear capacity growth with commodity machines, and losing one node is survivable. The price is complexity: load balancing, shared state, data partitioning and partial failures." },
            ],
          },
          {
            type: "tradeoff",
            question: "Your single PostgreSQL box is at 80% CPU. Scale up or scale out?",
            a: "Scale up: move to a larger instance. Hours of work, no application change, buys maybe 2-4x headroom.",
            b: "Scale out: add read replicas or shard. Weeks of work, introduces replication lag and routing logic, but removes the ceiling.",
            verdict: "Scale up first if it buys you a year or more, and use the time to fix slow queries and add caching. Scale out when growth projections clearly exceed the largest affordable machine.",
          },
        ],
      },
      {
        id: "stateless-services",
        heading: "Stateless services are what make scale-out easy",
        blocks: [
          { type: "p", text: "A service is **stateless** when any instance can serve any request, because nothing a request needs lives only in that instance's memory. Session data, shopping carts and uploaded files are pushed out to shared stores such as Redis, a database or object storage. Once that is true, adding capacity is just starting more instances behind the load balancer, and a crashed instance loses nothing." },
          { type: "p", text: "The classic anti-pattern in Spring applications is keeping the user session in the default in-memory `HttpSession`. That forces **sticky sessions** at the load balancer, so a user is pinned to one server: load spreads unevenly, and when that server restarts the user is logged out. Moving sessions to Redis (for example with Spring Session) or using self-contained JWTs removes the pinning." },
          {
            type: "diagram",
            chart: `graph LR
  C(["Clients"]) --> LB["Load Balancer"]
  LB --> A1["App Instance 1"]
  LB --> A2["App Instance 2"]
  LB --> A3["App Instance 3"]
  A1 --> R{{"Redis Sessions"}}
  A2 --> R
  A3 --> R
  A1 --> DB[("Primary DB")]
  A2 --> DB
  A3 --> DB
  A2 --> S3[("Object Storage")]`,
            caption: "Stateless app instances: all shared state lives in Redis, the database or object storage, so instances can be added or killed freely.",
          },
          { type: "callout", tone: "tip", title: "State has to live somewhere", text: "Making the app tier stateless does not remove state, it moves it. The database and cache now carry the scaling problem, which is why the next chapters on replication, sharding and caching matter so much." },
        ],
      },
      {
        id: "numbers-to-know",
        heading: "Numbers every engineer should know",
        blocks: [
          { type: "p", text: "Estimation only works if you carry a few reference numbers in your head. Exact values change with hardware generations, so memorize the **order of magnitude** and the ratios between rows. The key lessons: memory is about 1,000 times faster than an SSD random read, a network hop inside a datacenter costs roughly half a millisecond, and crossing a continent costs more than a hundred milliseconds no matter how fast your servers are." },
          {
            type: "table",
            head: ["Operation", "Approximate latency", "Takeaway"],
            rows: [
              ["L1 cache reference", "~1 ns", "Effectively free"],
              ["Main memory (RAM) reference", "~100 ns", "100x slower than L1, still very fast"],
              ["Compress 1 KB with a fast codec", "~2-3 µs", "Compression is usually cheaper than sending bytes"],
              ["Read 1 MB sequentially from RAM", "~10 µs", "Scanning memory is fast"],
              ["SSD random read (4 KB)", "~20-100 µs", "About 1,000x slower than RAM"],
              ["Round trip within one datacenter", "~0.5 ms", "Every extra service hop costs this"],
              ["Read 1 MB sequentially from SSD", "~0.5-1 ms", "Sequential IO is far cheaper than random"],
              ["Redis GET over the network", "~0.5-1 ms", "Dominated by the network, not Redis"],
              ["Indexed lookup in a relational DB", "~1-5 ms", "Includes network, parsing and a few page reads"],
              ["HDD seek", "~5-10 ms", "Why databases moved to SSD"],
              ["Read 1 MB sequentially from HDD", "~10-20 ms", "Fine for batch, bad for request paths"],
              ["Round trip Mumbai to US East", "~200 ms", "Speed of light; only a CDN or regional deployment helps"],
            ],
          },
          { type: "p", text: "The second table converts between powers of two, everyday units, and the sizes of common data items. For estimation it is fine to treat 1 KB as 1,000 bytes and 1 GB as a billion bytes." },
          {
            type: "table",
            head: ["Power", "Exact value", "Approx", "Unit"],
            rows: [
              ["2^10", "1,024", "1 thousand", "1 KB"],
              ["2^20", "1,048,576", "1 million", "1 MB"],
              ["2^30", "1,073,741,824", "1 billion", "1 GB"],
              ["2^40", "~1.1 trillion", "1 trillion", "1 TB"],
              ["2^50", "~1.13 quadrillion", "1 quadrillion", "1 PB"],
            ],
          },
          {
            type: "table",
            head: ["Item", "Typical size"],
            rows: [
              ["ASCII character", "1 byte (UTF-8 Hindi or emoji: 3-4 bytes)"],
              ["int / long / timestamp", "4 / 8 / 8 bytes"],
              ["UUID", "16 bytes binary, 36 bytes as text"],
              ["Typical database row with metadata", "0.5-1 KB"],
              ["Compressed photo for mobile", "200 KB - 2 MB"],
              ["One minute of 1080p video", "~50-100 MB"],
              ["Seconds in a day", "86,400, round to 10^5"],
              ["1 million requests per day", "~12 requests per second"],
            ],
          },
        ],
      },
      {
        id: "worked-estimate",
        heading: "A fully worked estimate: a photo-sharing app",
        blocks: [
          { type: "p", text: "Suppose the interviewer asks you to design a photo-sharing feed with **50 million daily active users**. Write the assumptions on the board first, then derive numbers from them. The interviewer cares far more about clear assumptions and sensible rounding than about the third significant digit." },
          {
            type: "list",
            ordered: true,
            items: [
              "**Assumptions:** each DAU posts 0.5 photos per day and opens the feed 10 times per day. Each feed page shows 20 posts. Average compressed photo is 300 KB, with a 30 KB thumbnail. Post metadata (ids, caption, timestamps, counters) is about 1 KB.",
              "**Write QPS:** 50M x 0.5 = 25M posts per day. 25M / 10^5 s = **~250 writes/s** on average. Assume peak is 3x average, so plan for **~750 writes/s**.",
              "**Read QPS:** 50M x 10 = 500M feed requests per day. 500M / 10^5 = **~5,000 feed requests/s**, peaking around **15,000/s**. The read to write ratio is about 20:1, so this is a read-heavy system and caching pays off.",
              "**Metadata storage:** 25M x 1 KB = 25 GB per day, roughly **9 TB per year**. That fits in a sharded relational or wide-column store comfortably.",
              "**Photo storage:** 25M x (300 KB + 30 KB) is about 8 TB per day, roughly **3 PB per year** before replication. This clearly belongs in object storage, not in the database.",
              "**Egress bandwidth:** each feed request loads 20 thumbnails: 500M x 20 x 30 KB = 300 TB per day, or about **3.5 GB/s** average. That number alone justifies a CDN in front of object storage.",
            ],
          },
          {
            type: "code",
            lang: "text",
            caption: "The same estimate in the compact form you would write on a whiteboard.",
            code: `DAU               = 50M
writes/day        = 50M * 0.5          = 25M     -> 25M / 1e5  = 250/s  (peak ~750/s)
feed reads/day    = 50M * 10           = 500M    -> 500M / 1e5 = 5K/s   (peak ~15K/s)
metadata/day      = 25M * 1 KB         = 25 GB   -> ~9 TB/year
photos/day        = 25M * 330 KB       = ~8 TB   -> ~3 PB/year
egress/day        = 500M * 20 * 30 KB  = 300 TB  -> ~3.5 GB/s`,
          },
          { type: "p", text: "Now the numbers drive design decisions. 750 writes per second is easy for a single well-tuned database, but 9 TB per year means you will outgrow one node in a couple of years, so you choose a shard key early. 15,000 feed reads per second with heavy fan-out calls for precomputed feeds in a cache. Petabytes of images mean object storage plus CDN. Each number earns a box in your diagram." },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "State assumptions out loud, round aggressively (one day is 10^5 seconds), separate average from peak, and split storage into metadata and blobs. Most importantly, **use the result**: say what the number implies, such as needing a CDN or sharding, instead of computing it and moving on. Do not spend more than 5 minutes here unless asked.",
          },
        ],
      },
      {
        id: "scaling-checklist",
        heading: "A practical scaling path",
        blocks: [
          { type: "p", text: "Interviewers often ask how a design evolves from launch to massive scale. A credible answer follows the bottleneck rather than jumping to the most complex architecture immediately." },
          {
            type: "list",
            ordered: true,
            items: [
              "Single server running app and database. Fine for the first thousands of users.",
              "Separate the database onto its own machine and scale it vertically.",
              "Make the app tier stateless and run several instances behind a load balancer.",
              "Add a cache (Redis) for hot reads and a CDN for static assets and media.",
              "Add read replicas to spread read traffic, accepting some replication lag.",
              "Move slow or bursty work (emails, thumbnails, notifications) to asynchronous workers behind a queue.",
              "Shard the database when write volume or data size exceeds one primary.",
              "Go multi-region when latency for distant users or regional disaster recovery requires it.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "sql-vs-nosql",
    title: "SQL vs NoSQL: Choosing a Data Store",
    level: "basic",
    summary: "The main families of databases, what each is genuinely good at, and a simple method for choosing one in an interview.",
    tags: ["databases", "sql", "nosql"],
    sections: [
      {
        id: "relational-and-acid",
        heading: "The relational model and ACID",
        blocks: [
          { type: "p", text: "Relational databases (PostgreSQL, MySQL, Oracle, SQL Server) store data as tables of rows with a fixed schema. Relationships are expressed with foreign keys and resolved at query time with joins. The power of the model is that you design the schema around the **data**, not around specific queries, and SQL lets you ask new questions later without restructuring storage." },
          { type: "p", text: "Their other big strength is transactions with **ACID** guarantees, which is why banks, payment systems and inventory systems default to them." },
          {
            type: "cards",
            items: [
              { title: "Atomicity", text: "All statements in a transaction succeed or none do. Debit and credit in a transfer cannot be half-applied." },
              { title: "Consistency", text: "A transaction moves the database from one valid state to another, respecting constraints like foreign keys, unique keys and checks." },
              { title: "Isolation", text: "Concurrent transactions do not see each other's partial work. The level (read committed, repeatable read, serializable) controls how strictly." },
              { title: "Durability", text: "Once committed, data survives a crash, typically because it was written to a write-ahead log on disk first." },
            ],
          },
          { type: "callout", tone: "warning", title: "Know your default isolation level", text: "PostgreSQL defaults to **read committed** and MySQL InnoDB to **repeatable read**. Neither is serializable by default, so a check-then-update pattern (read balance, then write a new balance) can still race. Use `SELECT ... FOR UPDATE`, an atomic `UPDATE ... SET balance = balance - 100 WHERE balance >= 100`, or optimistic locking with a version column." },
          { type: "p", text: "The traditional weakness is horizontal write scaling: a single primary handles all writes, and joins plus transactions across machines are hard. Modern distributed SQL systems (Google Spanner, CockroachDB, YugabyteDB) and sharding layers (Vitess, Citus) close much of that gap, at the cost of operational complexity and higher write latency." },
        ],
      },
      {
        id: "nosql-families",
        heading: "The NoSQL families",
        blocks: [
          { type: "p", text: "NoSQL is not one thing. It is a set of data models that each give up some relational generality in exchange for easier horizontal scaling, a more natural shape for certain data, or higher throughput for specific access patterns." },
          {
            type: "cards",
            items: [
              { title: "Key-value", text: "A distributed hash map: get, put and delete by key. Redis, DynamoDB, Riak. Extremely fast and simple to partition, but you can only query by key. Ideal for sessions, caches, carts, feature flags, URL mappings." },
              { title: "Document", text: "Stores JSON-like documents with nested fields and flexible schema. MongoDB, Couchbase, Firestore. Good when an entity is read and written as a whole (a product with variants, a user profile) and joins are rare." },
              { title: "Wide-column", text: "Rows identified by a partition key, with many sorted columns per partition. Cassandra, HBase, ScyllaDB, Bigtable. Built for huge write throughput and queries known in advance, such as messages per chat ordered by time." },
              { title: "Graph", text: "Nodes and edges as first-class citizens with fast traversal. Neo4j, Amazon Neptune. Good for social graphs, recommendations, fraud rings, where you ask questions like friends of friends who like X." },
              { title: "Time-series", text: "Optimized for append-heavy timestamped data with downsampling and retention. InfluxDB, TimescaleDB, Prometheus. Used for metrics, IoT sensor readings and monitoring." },
              { title: "Search engine", text: "Inverted indexes for full-text and faceted search. Elasticsearch, OpenSearch, Solr. Almost always a secondary store fed from a primary database." },
            ],
          },
          { type: "p", text: "A key mental shift with wide-column and key-value stores is **query-first modeling**. In Cassandra you design one table per query pattern and duplicate data across tables, because there are no joins and you must always query by partition key. That is the opposite of normalized relational design, and it is a common follow-up question." },
        ],
      },
      {
        id: "comparison",
        heading: "Side-by-side comparison",
        blocks: [
          {
            type: "table",
            head: ["Type", "Examples", "Query flexibility", "Scaling writes", "Transactions", "Typical use"],
            rows: [
              ["Relational", "PostgreSQL, MySQL", "High: ad hoc SQL, joins", "Single primary, shard manually", "Full ACID", "Orders, payments, users, inventory"],
              ["Key-value", "Redis, DynamoDB", "Lookup by key only", "Excellent", "Single key (DynamoDB has limited multi-item)", "Cache, session, cart"],
              ["Document", "MongoDB, Firestore", "Medium: query on fields, secondary indexes", "Good, built-in sharding", "Per document, multi-document in newer versions", "Catalog, profiles, CMS"],
              ["Wide-column", "Cassandra, HBase", "Low: by partition key, sorted by clustering key", "Excellent", "Very limited", "Chat history, event logs, feeds"],
              ["Graph", "Neo4j, Neptune", "High for traversals", "Harder to partition", "Yes in Neo4j", "Social graph, fraud detection"],
              ["Time-series", "InfluxDB, TimescaleDB", "Time-range aggregations", "Good", "Limited", "Metrics, IoT, monitoring"],
            ],
          },
          {
            type: "diagram",
            chart: `graph TD
  Q1{{"Need multi-row transactions or complex joins"}} -->|"yes"| SQL[("Relational DB")]
  Q1 -->|"no"| Q2{{"Access only by a single key"}}
  Q2 -->|"yes"| KV[("Key-value store")]
  Q2 -->|"no"| Q3{{"Massive write volume, queries known upfront"}}
  Q3 -->|"yes"| WC[("Wide-column store")]
  Q3 -->|"no"| Q4{{"Relationships are the query"}}
  Q4 -->|"yes"| GR[("Graph DB")]
  Q4 -->|"no"| DOC[("Document store or relational")]`,
            caption: "A rough decision path. Real systems often combine several stores, each serving the access pattern it is best at.",
          },
        ],
      },
      {
        id: "choosing-in-interview",
        heading: "How to choose in an interview",
        blocks: [
          { type: "p", text: "Do not pick a database by brand or fashion. Pick it by looking at the requirements you already wrote down and asking four questions." },
          {
            type: "list",
            ordered: true,
            items: [
              "**What are the access patterns?** List the top 3-5 queries. If they are all by a single key, a key-value store is enough. If they need filters and joins across entities, relational is the natural fit.",
              "**What correctness do we need?** Money, inventory counts and anything where a lost or duplicated write causes real harm push you toward ACID transactions.",
              "**What is the scale?** Use your estimate. A few thousand writes per second and a few TB is well within a single PostgreSQL primary with replicas. Hundreds of thousands of writes per second across many TB points to a natively distributed store.",
              "**How does the schema evolve?** Highly variable attributes (product specs that differ per category) are easier in a document store or a JSONB column.",
            ],
          },
          {
            type: "tradeoff",
            question: "Storing chat messages for a WhatsApp-style app: PostgreSQL or Cassandra?",
            a: "PostgreSQL: familiar, transactional, flexible queries. But billions of messages per day overwhelm a single primary, and sharding it yourself is significant work.",
            b: "Cassandra: partition by chat_id, cluster by message time. Linear write scaling and efficient time-ordered reads of one conversation, but no joins and limited transactions.",
            verdict: "Cassandra (or a similar wide-column store) for messages, because the access pattern is narrow and write volume is enormous. Keep users, groups and billing in a relational database. Using both is normal.",
          },
          { type: "callout", tone: "tip", title: "Polyglot persistence is fine", text: "Most production systems use several stores: PostgreSQL for core entities, Redis for caching, Elasticsearch for search, S3 for blobs. Saying so, and explaining what each one owns, sounds more senior than forcing everything into one database." },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A choice justified by access patterns, consistency needs and estimated scale, not by buzzwords. Mention the downside of your pick and how you would live with it. If you choose NoSQL, show the partition key and the main query. If you choose SQL, be ready to explain how it scales (replicas, then sharding).",
          },
        ],
      },
    ],
  },
  {
    slug: "database-indexing",
    title: "Database Indexing",
    level: "intermediate",
    summary: "How indexes turn full scans into fast lookups, how B-trees and LSM-trees differ, and how to design composite and covering indexes without crippling writes.",
    tags: ["indexing", "b-tree", "lsm", "databases"],
    sections: [
      {
        id: "why-indexes-help",
        heading: "Why indexes help",
        blocks: [
          { type: "p", text: "Without an index, a query like `SELECT * FROM orders WHERE user_id = 42` must read every row in the table and check the condition: a **full table scan**, O(n). With 100 million rows that means reading many gigabytes per query. An index is a separate data structure, kept sorted or hashed by the indexed column, that maps a value to the location of matching rows. The lookup becomes O(log n), typically 3-4 page reads even for billions of rows." },
          { type: "p", text: "The catch is that an index is redundant data. Every insert, update and delete must also update every index on the table, and the indexes take disk and memory. Indexing is therefore always a trade between faster reads and slower, more expensive writes." },
          { type: "callout", tone: "tip", title: "Use EXPLAIN", text: "In PostgreSQL run `EXPLAIN ANALYZE` and in MySQL run `EXPLAIN` to see whether a query uses an index (`Index Scan`, `ref`, `range`) or scans the table (`Seq Scan`, `ALL`). In interviews it is worth saying you would verify an index choice this way rather than guess." },
        ],
      },
      {
        id: "btree-vs-lsm",
        heading: "B-trees vs LSM-trees",
        blocks: [
          { type: "p", text: "Two storage structures dominate. **B-trees** (more precisely B+ trees) are used by PostgreSQL, MySQL InnoDB, Oracle and SQL Server. Data is kept in fixed-size pages (8 KB in Postgres, 16 KB in InnoDB) arranged as a balanced tree with a high fan-out of hundreds of keys per page. Leaf pages hold keys in sorted order and are linked, so both point lookups and range scans are efficient. Updates modify pages in place, protected by a write-ahead log." },
          { type: "p", text: "**LSM-trees** (log-structured merge trees) are used by Cassandra, RocksDB, LevelDB, HBase and ScyllaDB. Writes go to a write-ahead log and an in-memory sorted table (the memtable). When the memtable fills up, it is flushed to disk as an immutable sorted file called an SSTable. Background **compaction** merges SSTables and discards overwritten or deleted values. Reads check the memtable and then SSTables from newest to oldest, using per-file **Bloom filters** to skip files that cannot contain the key." },
          {
            type: "diagram",
            chart: `graph LR
  W(["Write"]) --> WAL[["Write-ahead log"]]
  W --> MT{{"Memtable in RAM"}}
  MT -->|"flush when full"| S1[("SSTable L0")]
  S1 -->|"compaction"| S2[("SSTable L1")]
  S2 -->|"compaction"| S3[("SSTable L2")]
  R(["Read"]) --> MT
  R --> BF{{"Bloom filters"}}
  BF --> S1
  BF --> S2
  BF --> S3`,
            caption: "LSM-tree write and read paths. Writes are sequential appends; reads may consult several levels, filtered by Bloom filters.",
          },
          {
            type: "table",
            head: ["Aspect", "B-tree", "LSM-tree"],
            rows: [
              ["Write pattern", "Random in-place page updates", "Sequential appends and flushes"],
              ["Write throughput", "Good", "Very high"],
              ["Point reads", "Predictable, one tree descent", "May check several SSTables"],
              ["Range scans", "Excellent, linked leaves", "Good, but merges across files"],
              ["Space usage", "Some fragmentation from page splits", "Temporary overhead until compaction"],
              ["Background work", "Vacuum (Postgres), page merges", "Compaction, which competes for IO"],
              ["Typical systems", "PostgreSQL, MySQL, Oracle", "Cassandra, RocksDB, HBase"],
            ],
          },
          {
            type: "tradeoff",
            question: "Storing a high-volume event log with 200,000 inserts per second: B-tree or LSM-tree engine?",
            a: "B-tree: strong reads and range scans, but random page writes and index maintenance become the bottleneck at this rate.",
            b: "LSM-tree: turns writes into sequential IO and absorbs bursts, with slightly less predictable read latency and compaction to tune.",
            verdict: "LSM-tree. For write-heavy, append-mostly data the sequential write path wins. Choose a B-tree engine when reads dominate and you need predictable latency and transactions.",
          },
        ],
      },
      {
        id: "index-types",
        heading: "Hash, composite and covering indexes",
        blocks: [
          { type: "p", text: "A **hash index** maps a hashed key to row locations. It supports only equality (`WHERE id = ?`) in O(1), not ranges or sorting. PostgreSQL has hash indexes, but B-trees are almost always used instead because they handle equality nearly as fast and also support ranges. Hash-based lookups shine in in-memory key-value stores like Redis." },
          { type: "p", text: "A **composite index** covers several columns, and **column order matters**. The index on `(user_id, created_at)` is sorted first by user, then by time within each user. It can serve queries that filter on `user_id` alone or on `user_id` plus `created_at`, but not efficiently on `created_at` alone. This is the **leftmost prefix rule**. A good default ordering is: equality columns first, then the column used for range or sort." },
          {
            type: "code",
            lang: "sql",
            caption: "One composite index serving the most common query of an order history page.",
            code: `CREATE INDEX idx_orders_user_time ON orders (user_id, created_at DESC);

-- Uses the index: equality on the first column, sort on the second.
SELECT id, total, status
FROM orders
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;

-- Uses the index for user_id, then filters the range within that user.
SELECT id FROM orders
WHERE user_id = 42 AND created_at >= '2026-01-01';

-- Cannot use the index efficiently: the leading column is missing.
SELECT id FROM orders WHERE created_at >= '2026-01-01';

-- Covering index (PostgreSQL 11+): the query is answered from the index alone.
CREATE INDEX idx_orders_user_time_cov
  ON orders (user_id, created_at DESC) INCLUDE (total, status);`,
          },
          { type: "p", text: "A **covering index** contains every column a query needs, so the database can answer from the index without visiting the table rows at all (an index-only scan). In MySQL InnoDB, secondary indexes store the primary key, and fetching other columns needs a second lookup in the clustered primary index, so covering indexes save a whole extra tree descent per row." },
          { type: "callout", tone: "warning", title: "Random UUID primary keys", text: "InnoDB stores rows physically ordered by the primary key (a clustered index). Random UUIDv4 keys scatter inserts across the tree, causing page splits and poor cache usage. Prefer an auto-increment `BIGINT` or a time-ordered id such as UUIDv7 or a Snowflake-style id." },
        ],
      },
      {
        id: "inverted-indexes",
        heading: "Inverted indexes",
        blocks: [
          { type: "p", text: "B-trees index whole values. To find rows where a text column **contains** a word, a leading-wildcard query like `LIKE '%phone%'` cannot use a B-tree and falls back to a scan. An **inverted index** flips the relationship: for each term it stores the list of documents (a posting list) containing it. Searching for a word becomes a lookup of that term's posting list, and multi-word queries intersect lists." },
          { type: "p", text: "PostgreSQL offers GIN indexes for full-text search (`tsvector`), JSONB containment and array membership. Dedicated engines like Elasticsearch are built entirely around inverted indexes and add relevance scoring, covered in the storage and search chapter." },
        ],
      },
      {
        id: "write-cost",
        heading: "The write cost of indexes",
        blocks: [
          { type: "p", text: "Each index adds work to every write. A table with six indexes turns one logical insert into seven structure updates, each possibly touching a different disk page. Indexes also compete for buffer pool memory: if the hot parts of your indexes no longer fit in RAM, reads slow down too." },
          {
            type: "list",
            items: [
              "Index for the queries you actually run, starting from slow query logs, not for every column.",
              "One well-ordered composite index often replaces two or three single-column indexes.",
              "Drop unused indexes. PostgreSQL's `pg_stat_user_indexes` shows indexes with zero scans.",
              "Avoid indexing low-cardinality columns alone (a boolean `is_active`); the database will often ignore it. A partial index such as `WHERE is_active` can be a better fit.",
              "For bulk loads, consider building indexes after loading the data.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "When you write a schema, name the index for each main query and justify the column order. Know the leftmost prefix rule, what a covering index buys, and that LSM engines favor writes while B-trees favor reads. Show awareness that every index slows writes, so you index deliberately.",
          },
        ],
      },
    ],
  },
  {
    slug: "replication",
    title: "Replication",
    level: "intermediate",
    summary: "Keeping copies of data on multiple machines for availability and read scale, and the lag, anomalies and failover problems that come with it.",
    tags: ["replication", "availability", "consistency"],
    sections: [
      {
        id: "why-replicate",
        heading: "Why replicate",
        blocks: [
          { type: "p", text: "Replication means keeping a copy of the same data on several nodes. It serves three goals: **availability** (if one node dies, another has the data), **read scalability** (spread reads across copies), and **latency** (place copies close to users in other regions). The hard part is not copying data once, it is handling changes: every write must reach every replica, and the system must decide what happens when replicas disagree or a node fails mid-way." },
        ],
      },
      {
        id: "topologies",
        heading: "Leader-follower, multi-leader and leaderless",
        blocks: [
          {
            type: "cards",
            items: [
              { title: "Leader-follower (single leader)", text: "All writes go to one leader, which streams changes to followers. Followers serve reads. Used by PostgreSQL streaming replication, MySQL replication, MongoDB replica sets and Redis. Simple and avoids write conflicts, but the leader is the write bottleneck and failover is needed when it dies." },
              { title: "Multi-leader", text: "Several nodes accept writes, typically one leader per region, and replicate to each other. Good for multi-region writes and offline clients (calendar apps, collaborative editors). The cost is write conflicts, which must be resolved by last-write-wins, merge logic or CRDTs." },
              { title: "Leaderless", text: "Clients (or a coordinator) send writes to several replicas at once and read from several, using quorums to decide. Used by Cassandra, ScyllaDB and the original Dynamo design. No failover step, tolerant of node failures, but consistency is tunable rather than guaranteed and needs repair mechanisms." },
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  APP["App Servers"] -->|"writes"| L[("Leader")]
  L -->|"replication stream"| F1[("Follower 1")]
  L -->|"replication stream"| F2[("Follower 2")]
  APP -->|"reads"| F1
  APP -->|"reads"| F2
  APP -->|"read-your-writes reads"| L`,
            caption: "Leader-follower replication: writes go to the leader, most reads go to followers, and reads that must be fresh go to the leader.",
          },
          { type: "p", text: "Leaderless systems also need ways to heal stale replicas: **read repair** (a read that sees an old value writes the newer one back) and **anti-entropy** (background comparison of replicas, often with Merkle trees). With **hinted handoff**, a node temporarily stores writes meant for a down replica and forwards them when it returns." },
        ],
      },
      {
        id: "sync-vs-async",
        heading: "Synchronous vs asynchronous replication",
        blocks: [
          { type: "p", text: "With **synchronous** replication, the leader waits for a follower to confirm the write before acknowledging the client. The data is guaranteed to exist on two machines, but write latency includes the slowest required follower, and if that follower is down, writes stall. With **asynchronous** replication the leader acknowledges immediately and ships changes in the background: fast and resilient to slow followers, but a leader crash can lose the most recent acknowledged writes." },
          { type: "p", text: "Most production setups use a middle ground. MySQL **semi-synchronous** replication waits for at least one replica to receive the change. PostgreSQL lets you name synchronous standbys and choose `synchronous_commit` levels per transaction, so a payment can wait for a standby while a page-view counter does not." },
          {
            type: "tradeoff",
            question: "Payments ledger in a single region: synchronous or asynchronous replication?",
            a: "Synchronous to at least one standby: no acknowledged payment is ever lost on failover, at the cost of a few extra milliseconds per write and sensitivity to standby health.",
            b: "Asynchronous: lowest write latency and the leader never waits, but a crash can lose the last fraction of a second of committed payments.",
            verdict: "Synchronous (or semi-synchronous) to one nearby standby, with other replicas asynchronous. Losing money records is worse than slightly slower writes. For a social feed, asynchronous is fine.",
          },
        ],
      },
      {
        id: "replication-lag",
        heading: "Replication lag and its anomalies",
        blocks: [
          { type: "p", text: "With asynchronous followers there is always some **replication lag**: usually milliseconds, but seconds or minutes under heavy load or after a network hiccup. Reading from a lagging follower produces anomalies that users notice." },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant U as User
  participant L as Leader
  participant F as Follower
  U->>L: UPDATE profile name to Priya
  L-->>U: 200 OK
  U->>F: GET profile
  F-->>U: old name, change not replicated yet
  L->>F: replicate name change`,
            caption: "A read-your-writes violation: the user saves a change, refreshes, and sees the old value because the read hit a lagging follower.",
          },
          {
            type: "table",
            head: ["Anomaly", "What the user sees", "Common fix"],
            rows: [
              ["Read-your-writes", "Their own update seems to disappear after refresh", "Read the user's own data from the leader, or from the leader for N seconds after a write, or wait until a replica has the write's log position"],
              ["Monotonic reads", "Data appears, then vanishes on the next refresh as requests hit different replicas", "Pin each user to one replica (for example by hashing user id)"],
              ["Consistent prefix", "An answer appears before the question it replies to", "Write causally related data to the same partition, or track causal dependencies"],
            ],
          },
          { type: "callout", tone: "tip", title: "Tracking log positions", text: "A precise read-your-writes technique: after a write, remember the leader's log position (Postgres LSN, MySQL GTID) in the user's session. Route their reads to any replica that has replayed at least that position, falling back to the leader if none has." },
        ],
      },
      {
        id: "failover",
        heading: "Failover",
        blocks: [
          { type: "p", text: "When a leader fails, a follower must be promoted. Automatic failover has three steps: **detect** the failure (usually missed heartbeats over a timeout), **choose** a new leader (normally the most up-to-date replica, sometimes via a consensus system like etcd or ZooKeeper, as in Patroni for Postgres), and **reconfigure** clients and other followers to use it." },
          {
            type: "list",
            items: [
              "**Lost writes:** with asynchronous replication, writes the old leader acknowledged but never shipped are gone. If the old leader rejoins, its divergent writes must be discarded, which can break things like auto-increment ids already handed out.",
              "**Split brain:** if the old leader was only partitioned, not dead, two nodes may accept writes. Systems prevent this with **fencing**: an epoch or term number that makes the old leader's writes rejected, or forcibly shutting it down.",
              "**Timeout tuning:** too short and you fail over during a brief GC pause or network blip, too long and you stay down longer. Typical values are tens of seconds.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Pick a topology and say why (single leader is the default answer). State whether replication is sync or async and what that means for data loss. Proactively mention replication lag and a concrete read-your-writes fix, and show you know failover risks: lost writes and split brain, handled with fencing.",
          },
        ],
      },
    ],
  },
  {
    slug: "sharding-and-partitioning",
    title: "Sharding and Partitioning",
    level: "intermediate",
    summary: "Splitting data across many machines so writes and storage scale, and choosing shard keys that avoid hot spots and painful cross-shard queries.",
    tags: ["sharding", "consistent-hashing", "scaling"],
    sections: [
      {
        id: "why-shard",
        heading: "Why shard",
        blocks: [
          { type: "p", text: "Replication copies the same data to more machines, which scales reads but not writes or storage: every replica still holds everything and applies every write. **Sharding** (horizontal partitioning) splits the data so each node owns a subset of rows. With 8 shards, each handles roughly one eighth of the writes and stores one eighth of the data. Each shard is usually also replicated for availability, so the two techniques are combined, not alternatives." },
          { type: "p", text: "Sharding is expensive in complexity, so it should come after cheaper options: query and index tuning, caching, read replicas and vertical scaling. Your estimate tells you when it is truly needed, for example when data size will exceed a few TB per node or sustained writes exceed what one primary handles." },
        ],
      },
      {
        id: "strategies",
        heading: "Range, hash and directory-based partitioning",
        blocks: [
          {
            type: "table",
            head: ["Strategy", "How it works", "Strengths", "Weaknesses"],
            rows: [
              ["Range", "Each shard owns a contiguous key range, such as user ids 1-1M, or dates per month", "Efficient range scans, easy to reason about", "Hot spots when keys are sequential (all new writes hit the last range)"],
              ["Hash", "shard = hash(key) mod N, or a hash ring", "Even distribution of keys and load", "Range queries must hit every shard; naive mod N makes resharding painful"],
              ["Directory-based", "A lookup service maps each key (or tenant) to a shard", "Total flexibility, can move individual tenants", "Directory is an extra hop and a critical dependency that must be cached and highly available"],
            ],
          },
          { type: "p", text: "HBase and Bigtable use range partitioning and split ranges automatically as they grow. Cassandra and DynamoDB hash the partition key. Directory-based schemes are common in multi-tenant SaaS, where a large customer can be moved onto a dedicated shard by updating one directory entry." },
        ],
      },
      {
        id: "consistent-hashing",
        heading: "Consistent hashing and virtual nodes",
        blocks: [
          { type: "p", text: "With `hash(key) mod N`, changing N from 4 to 5 changes the shard of about 80% of keys, which means moving most of the data. **Consistent hashing** places both nodes and keys on a ring of hash values. A key belongs to the first node clockwise from its position. When a node is added, it only takes over keys from its clockwise neighbor, so about 1/N of the data moves." },
          { type: "p", text: "With only a few points on the ring, the arcs between nodes are uneven and one node may own far more keys than another. **Virtual nodes** fix this: each physical node is placed at many points (for example 100-256), so ownership averages out. Virtual nodes also let a more powerful machine take more points, and when a node leaves, its load spreads across many others instead of landing on one neighbor." },
          {
            type: "diagram",
            chart: `graph LR
  K1(["key user 42"]) -->|"hash lands at 1100"| VA1["Node A vnode at 1500"]
  K2(["key user 77"]) -->|"hash lands at 4200"| VB2["Node B vnode at 5000"]
  K3(["key user 91"]) -->|"hash lands at 7600"| VC1["Node C vnode at 8000"]
  VA1 --> PA[("Physical Node A")]
  VB2 --> PB[("Physical Node B")]
  VC1 --> PC[("Physical Node C")]`,
            caption: "Each key walks clockwise to the next virtual node on the ring, and each virtual node maps to a physical machine.",
          },
          {
            type: "code",
            lang: "java",
            caption: "A minimal consistent hash ring in Java using TreeMap. ceilingEntry finds the next node clockwise.",
            code: `public class ConsistentHashRing {
    private final TreeMap<Long, String> ring = new TreeMap<>();
    private final int virtualNodes;

    public ConsistentHashRing(int virtualNodes) {
        this.virtualNodes = virtualNodes;
    }

    public void addNode(String node) {
        for (int i = 0; i < virtualNodes; i++) {
            ring.put(hash(node + "-vn" + i), node);
        }
    }

    public void removeNode(String node) {
        for (int i = 0; i < virtualNodes; i++) {
            ring.remove(hash(node + "-vn" + i));
        }
    }

    public String nodeFor(String key) {
        Map.Entry<Long, String> e = ring.ceilingEntry(hash(key));
        return (e != null ? e : ring.firstEntry()).getValue();
    }

    private long hash(String s) {
        // String.hashCode clusters badly; real systems use MurmurHash or similar.
        return Hashing.murmur3_128().hashString(s, StandardCharsets.UTF_8).asLong();
    }
}`,
          },
          { type: "callout", tone: "tip", title: "Fixed logical partitions", text: "An alternative used by Kafka, Elasticsearch, Couchbase and many in-house systems: create many more logical partitions than nodes up front (say 1,024), assign partitions to nodes, and move whole partitions when nodes are added. The key-to-partition mapping never changes, only partition-to-node." },
        ],
      },
      {
        id: "shard-key",
        heading: "Choosing a shard key and avoiding hot spots",
        blocks: [
          { type: "p", text: "The shard key is the most consequential decision in a sharded design, because it is very hard to change later. A good key has **high cardinality** (many distinct values), spreads **load** as well as data evenly, and matches the **main query** so that most requests touch one shard." },
          {
            type: "list",
            items: [
              "**Orders in an e-commerce app:** shard by `user_id`. Order history for a user is a single-shard query. Seller dashboards then need a separate view.",
              "**Chat messages:** shard by `conversation_id`, so a conversation's messages live together and are ordered by time within the shard.",
              "**Multi-tenant SaaS:** shard by `tenant_id`, which also gives tenant isolation, but watch for one giant tenant.",
              "**Bad choices:** `created_at` (every new write hits the latest shard), `country` (low cardinality and very skewed, with India alone dwarfing most others), or a boolean.",
            ],
          },
          { type: "p", text: "Even a good key can produce a **hot key**: a celebrity's posts, a flash-sale product, or a viral tweet. Mitigations include caching that key aggressively, adding a random suffix to split one logical key across several partitions (writes spread out, reads gather from all suffixes), and handling known heavy hitters on a separate path." },
          {
            type: "tradeoff",
            question: "Sharding a social app's posts: by user_id or by post_id?",
            a: "user_id: a user's posts are on one shard, so profile pages are fast single-shard reads. But celebrity accounts create hot shards.",
            b: "post_id: perfectly even spread of writes and storage, but showing one user's posts becomes a scatter-gather across all shards.",
            verdict: "Usually user_id, because profile reads dominate, combined with caching for celebrity accounts. Pick post_id only if posts are mostly fetched individually by id.",
          },
        ],
      },
      {
        id: "cross-shard-and-resharding",
        heading: "Cross-shard queries and resharding",
        blocks: [
          { type: "p", text: "Any query that does not include the shard key must ask every shard and merge results (**scatter-gather**). Latency becomes that of the slowest shard, and load multiplies with shard count. Joins and transactions across shards are worse: they need two-phase commit or a saga, both slower and more fragile than a local transaction." },
          {
            type: "list",
            items: [
              "**Denormalize:** store the data needed together on the same shard, even if duplicated.",
              "**Global secondary index:** a separate table partitioned by the other key (for example orders by seller_id), maintained asynchronously. DynamoDB offers this built in.",
              "**Offload analytics:** stream changes to a warehouse or Elasticsearch for queries that span everything.",
            ],
          },
          { type: "p", text: "**Resharding** (changing the number or layout of shards) is needed when data grows or a shard gets hot. The safe pattern is: start copying data to the new layout, dual-write or replay the change log to keep it current, verify, switch reads, switch writes, then clean up. Tools like Vitess for MySQL and Citus for Postgres automate much of this. Planning with consistent hashing or many logical partitions from day one keeps the amount of data moved small." },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A shard key justified by the main access pattern, with a clear statement of which queries become scatter-gather and how you handle them. Knowing why `mod N` breaks on resharding and how consistent hashing with virtual nodes fixes it. Proactively naming the hot key problem and a mitigation.",
          },
        ],
      },
    ],
  },
  {
    slug: "cap-and-consistency",
    title: "CAP, PACELC and Consistency Models",
    level: "intermediate",
    summary: "What CAP really says, why PACELC is more useful day to day, the main consistency models, and how quorums trade consistency against latency.",
    tags: ["cap", "consistency", "quorum"],
    sections: [
      {
        id: "cap-precisely",
        heading: "CAP stated precisely",
        blocks: [
          { type: "p", text: "The CAP theorem is often quoted as pick two of consistency, availability and partition tolerance. That framing is misleading. In a distributed system, network partitions (messages lost or delayed between nodes) are not optional; they will happen. CAP says: **when a partition occurs, a system must choose between consistency and availability** for the operations affected." },
          {
            type: "cards",
            items: [
              { title: "Consistency (in CAP)", text: "Specifically **linearizability**: every read sees the most recent completed write, as if there were a single copy of the data. Not the same C as in ACID." },
              { title: "Availability (in CAP)", text: "Every request received by a non-failing node gets a non-error response, without a guarantee that it reflects the latest write." },
              { title: "Partition tolerance", text: "The system continues to operate even when the network drops or delays messages between nodes. Not something you can opt out of across machines." },
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  C1(["Client in Mumbai"]) --> N1[("Replica A")]
  C2(["Client in Singapore"]) --> N2[("Replica B")]
  N1 -.->|"network partition, no messages"| N2
  N1 --> D{{"Choice during partition"}}
  D -->|"CP: reject writes on minority side"| E1["Error or timeout"]
  D -->|"AP: accept on both sides"| E2["Divergent data, reconcile later"]`,
            caption: "During a partition, a replica that cannot reach its peers either refuses requests (CP) or serves possibly stale or conflicting data (AP).",
          },
          { type: "p", text: "A **CP** system (ZooKeeper, etcd, HBase, a single-leader database that refuses writes without quorum) returns errors on the minority side to avoid inconsistency. An **AP** system (Cassandra and DynamoDB in their default configurations, DNS) keeps answering and reconciles later. Many databases are configurable per operation, so labels describe defaults, not laws." },
        ],
      },
      {
        id: "pacelc",
        heading: "PACELC: the trade-off that exists all the time",
        blocks: [
          { type: "p", text: "Partitions are rare, but the consistency trade-off exists every millisecond. **PACELC** extends CAP: if there is a **P**artition, choose **A**vailability or **C**onsistency, **E**lse (normal operation) choose **L**atency or **C**onsistency. Waiting for multiple replicas, possibly in other regions, to confirm every write gives stronger consistency but adds latency to every request." },
          {
            type: "table",
            head: ["System (typical configuration)", "During partition", "Normal operation", "Label"],
            rows: [
              ["Cassandra, DynamoDB (default)", "Stay available", "Favor low latency", "PA/EL"],
              ["Google Spanner, CockroachDB", "Stay consistent", "Pay latency for consistency", "PC/EC"],
              ["ZooKeeper, etcd", "Consistent, minority unavailable", "Consistent writes through the leader", "PC/EC"],
              ["MongoDB (majority writes)", "Consistent, minority side cannot write", "Mostly consistent, latency depends on read and write concern", "PC/EC (roughly)"],
            ],
          },
        ],
      },
      {
        id: "consistency-models",
        heading: "Consistency models",
        blocks: [
          { type: "p", text: "Consistency is a spectrum. Stronger models are easier to program against but cost latency and availability. Weaker models scale and stay up, but push complexity to the application." },
          {
            type: "table",
            head: ["Model", "Guarantee", "Example use"],
            rows: [
              ["Linearizable (strong)", "Operations appear to take effect atomically at a single point in time, in real-time order. Once a write completes, every later read sees it.", "Leader election, distributed locks, unique username claims, account balances"],
              ["Sequential", "All nodes see operations in the same order, consistent with each client's order, but not necessarily real time", "Rarely chosen explicitly"],
              ["Causal", "Operations that are causally related (a reply after the post it replies to) are seen in that order by everyone. Concurrent operations may be seen in different orders.", "Comments and replies, chat, collaborative apps"],
              ["Read-your-writes", "A client always sees its own earlier writes", "Profile edits, settings pages"],
              ["Eventual", "If writes stop, all replicas converge to the same value eventually. No bound on when.", "Like counts, view counts, DNS, product reviews"],
            ],
          },
          { type: "p", text: "Note that **strong consistency** is used loosely in practice. In interviews it usually means linearizable reads and writes for the data in question. Be precise when it matters: a Postgres primary with synchronous replicas gives linearizable reads only if you read from the primary." },
          {
            type: "tradeoff",
            question: "Like counter on a viral post: strong or eventual consistency?",
            a: "Strong: every viewer sees the exact count, but every like contends on one row or needs a cross-replica round trip.",
            b: "Eventual: increments are batched or applied per replica and merged, counts may be off for a few seconds.",
            verdict: "Eventual. Nobody is harmed by a like count that is a few seconds stale, and the write volume would make strong consistency expensive. Reserve strong consistency for money, inventory and uniqueness.",
          },
        ],
      },
      {
        id: "quorums",
        heading: "Quorums: R + W > N",
        blocks: [
          { type: "p", text: "Leaderless systems like Cassandra let you tune consistency per request with quorums. Each key is stored on **N** replicas. A write is successful when **W** replicas acknowledge it, and a read queries **R** replicas and returns the value with the newest timestamp or version. If **R + W > N**, the set of replicas read must overlap with the set written in at least one node, so a read sees the latest successful write." },
          {
            type: "list",
            items: [
              "**N = 3, W = 2, R = 2:** 2 + 2 > 3, so reads overlap writes. The system tolerates one replica down for both reads and writes. This is Cassandra's `QUORUM` level with replication factor 3, the common default for important data.",
              "**N = 3, W = 3, R = 1:** fast reads, but any single replica failure blocks writes.",
              "**N = 3, W = 1, R = 1:** lowest latency and highest availability, but 1 + 1 is not greater than 3, so reads may return stale data. Fine for metrics or activity logs.",
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  WR(["Writer"]) -->|"write v2"| A[("Replica 1 has v2")]
  WR -->|"write v2"| B[("Replica 2 has v2")]
  WR -.->|"slow or failed"| C[("Replica 3 still v1")]
  RD(["Reader"]) -->|"read"| B
  RD -->|"read"| C
  B -->|"returns newest, v2"| RD`,
            caption: "N = 3, W = 2, R = 2. The read set (replicas 2 and 3) overlaps the write set (replicas 1 and 2) at replica 2, so the newest value wins. Read repair can then update replica 3.",
          },
          { type: "callout", tone: "warning", title: "Quorums are not a full guarantee", text: "R + W > N does not by itself give linearizability. Sloppy quorums with hinted handoff, concurrent writes resolved by last-write-wins with skewed clocks, and writes that succeeded on fewer than W nodes (reported as failures but not rolled back) can all produce surprising reads. Use it as a strong tool, not a proof." },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "State CAP correctly: the choice only applies during a partition, and C means linearizability. Use PACELC to discuss the everyday latency cost. Pick a consistency level **per data type** (strong for payments and inventory, eventual for counters and feeds) and show quorum math with a concrete N, W and R.",
          },
        ],
      },
    ],
  },
  {
    slug: "message-queues-and-streams",
    title: "Message Queues and Event Streams",
    level: "intermediate",
    summary: "How queues, pub/sub and logs like Kafka decouple services, what delivery guarantees really mean, and how to handle ordering, failures and backpressure.",
    tags: ["kafka", "queues", "async"],
    sections: [
      {
        id: "why-async",
        heading: "Why put a queue between services",
        blocks: [
          { type: "p", text: "When an order service calls email, inventory and analytics services synchronously, the user waits for all of them, and if any is down the order fails. Putting a message broker in between **decouples** them: the producer writes a message and returns, consumers process it at their own pace. Queues absorb traffic spikes (a flash sale can produce 10x normal orders for a few minutes), let you scale producers and consumers independently, and allow retries without the user waiting." },
          { type: "p", text: "The cost is that the system becomes **eventually consistent** and harder to debug: work happens later, possibly twice, possibly out of order. The rest of this chapter is about controlling those effects." },
        ],
      },
      {
        id: "queue-pubsub-log",
        heading: "Queue vs pub/sub vs log",
        blocks: [
          {
            type: "table",
            head: ["Model", "Delivery", "After consumption", "Examples", "Good for"],
            rows: [
              ["Point-to-point queue", "Each message goes to one of the competing consumers", "Deleted once acknowledged", "RabbitMQ queues, Amazon SQS, ActiveMQ", "Background jobs, task distribution"],
              ["Pub/sub", "Each message is delivered to every subscriber", "Usually not retained after delivery", "Amazon SNS, Google Pub/Sub, Redis Pub/Sub, RabbitMQ fanout", "Notifications, broadcasting events to several services"],
              ["Log (stream)", "Consumers read from an offset in an ordered, append-only log", "Retained for a configured time, can be replayed", "Apache Kafka, Amazon Kinesis, Apache Pulsar, Redpanda", "Event-driven architectures, CDC, analytics pipelines, replay"],
            ],
          },
          { type: "p", text: "Kafka organizes data into **topics**, each split into **partitions**. A partition is an append-only log where every message has an increasing **offset**. Messages are kept for a retention period (for example 7 days) regardless of whether they were read, so a new consumer can start from the beginning and a buggy consumer can rewind and reprocess. That replayability is the main reason to choose a log over a classic queue." },
          {
            type: "diagram",
            chart: `graph LR
  P1(["Order Service"]) -->|"key order id"| T0[["orders partition 0"]]
  P1 --> T1[["orders partition 1"]]
  P1 --> T2[["orders partition 2"]]
  T0 --> CA1["Email consumer 1"]
  T1 --> CA2["Email consumer 2"]
  T2 --> CA2
  T0 --> CB1["Analytics consumer"]
  T1 --> CB1
  T2 --> CB1`,
            caption: "Two consumer groups read the same topic independently. Within the email group, each partition is assigned to exactly one consumer.",
          },
        ],
      },
      {
        id: "delivery-semantics",
        heading: "Delivery semantics",
        blocks: [
          { type: "p", text: "Failures can happen between processing a message and recording that it was processed. Where you record progress determines the guarantee." },
          {
            type: "cards",
            items: [
              { title: "At-most-once", text: "Commit the offset (or ack) before processing. If the consumer crashes mid-processing, the message is skipped. Acceptable for metrics or logs where loss is tolerable." },
              { title: "At-least-once", text: "Process first, then commit. A crash after processing but before commit causes redelivery, so duplicates happen. This is the default for most systems and the right choice for most business events." },
              { title: "Effectively-once", text: "At-least-once delivery plus an idempotent consumer, so duplicates have no extra effect. Kafka's idempotent producer and transactions give exactly-once for read-process-write flows that stay inside Kafka; side effects outside Kafka still need idempotency." },
            ],
          },
          {
            type: "code",
            lang: "sql",
            caption: "An idempotent consumer: record the message id in the same transaction as the business change, so a redelivered message is a no-op.",
            code: `BEGIN;

INSERT INTO processed_messages (message_id, processed_at)
VALUES ('evt-8f2c91', now())
ON CONFLICT (message_id) DO NOTHING;
-- If zero rows were inserted, this message was already handled: ROLLBACK and ack it.

UPDATE wallets SET balance = balance + 500 WHERE user_id = 42;

COMMIT;`,
          },
          {
            type: "tradeoff",
            question: "Crediting a wallet from a payment-success event: at-most-once or at-least-once with idempotency?",
            a: "At-most-once: never double-credits, but a crash means the user paid and never received the credit.",
            b: "At-least-once plus an idempotency key on the event id: every event is applied, duplicates are detected and ignored.",
            verdict: "At-least-once with an idempotent consumer. Losing a payment is unacceptable, and deduplication by event id is cheap. This combination is what people usually mean by exactly-once in practice.",
          },
        ],
      },
      {
        id: "ordering-and-groups",
        heading: "Ordering and consumer groups",
        blocks: [
          { type: "p", text: "Kafka guarantees order **only within a partition**. Messages with the same key go to the same partition, so choose the key to be the entity whose events must stay ordered: `order_id` keeps created, paid, shipped for one order in sequence, while different orders proceed in parallel. Global ordering across a whole topic requires a single partition, which caps throughput at one consumer." },
          { type: "p", text: "A **consumer group** is a set of consumers sharing the work of a topic. Each partition is assigned to exactly one consumer in the group, so the maximum parallelism equals the number of partitions: a topic with 12 partitions can use at most 12 active consumers per group. Different groups (email, analytics, search indexer) each receive every message. When consumers join or leave, the group **rebalances** partitions, which briefly pauses consumption." },
          { type: "callout", tone: "warning", title: "Retries can break ordering", text: "If a consumer moves a failed message to a retry topic and continues, later events for the same key may be processed first. When strict per-key order matters, either block that partition until the message succeeds or park all subsequent events for that key too." },
        ],
      },
      {
        id: "failures-and-backpressure",
        heading: "Dead-letter queues and backpressure",
        blocks: [
          { type: "p", text: "Some messages will never succeed: malformed payloads, references to deleted data, bugs. Retrying them forever blocks the queue (a **poison message**). After a fixed number of retries with exponential backoff, move the message to a **dead-letter queue** (DLQ), alert on it, and let engineers inspect, fix and replay. SQS supports this natively with a redrive policy; in Kafka it is implemented by the consumer, for example Spring Kafka's `DeadLetterPublishingRecoverer`." },
          { type: "p", text: "**Backpressure** is how a system copes when producers outpace consumers. A queue buys time, but if the gap persists the backlog grows without bound, latency climbs and eventually storage runs out." },
          {
            type: "list",
            items: [
              "**Monitor consumer lag** (messages behind the latest offset) and alert on it. It is the single most important queue metric.",
              "**Autoscale consumers** on lag, up to the partition count.",
              "**Pull-based consumption** (Kafka, SQS) lets consumers take only what they can handle, unlike push systems that can overwhelm them.",
              "**Bound the queue** and reject or rate-limit producers when full, returning 429 or 503 instead of accepting work that cannot be done in time.",
              "**Shed or degrade**: drop low-priority work (analytics) before high-priority work (payments), ideally using separate topics.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A clear reason for adding a queue (decoupling, spike absorption, retries), the right model for the job (queue for tasks, log for event streams and replay), and an explicit delivery guarantee with an idempotency strategy. Strong candidates name the partition key for ordering, mention DLQs and say how they would detect and handle growing consumer lag.",
          },
        ],
      },
    ],
  },
  {
    slug: "storage-and-search",
    title: "Storage and Search",
    level: "basic",
    summary: "Block, file and object storage and when to use each, plus how full-text search engines like Elasticsearch work and stay in sync with your database.",
    tags: ["s3", "elasticsearch", "search"],
    sections: [
      {
        id: "storage-types",
        heading: "Block vs file vs object storage",
        blocks: [
          { type: "p", text: "Not every byte belongs in a database. Large binary data (images, videos, PDFs, backups) is stored differently depending on how it is accessed. The three main abstractions differ in the interface they expose." },
          {
            type: "cards",
            items: [
              { title: "Block storage", text: "Raw fixed-size blocks presented as a disk, attached to one machine at a time. The OS puts a filesystem on it. Low latency, ideal for databases and VM boot volumes. Examples: Amazon EBS, local NVMe SSDs." },
              { title: "File storage", text: "A shared hierarchical filesystem with directories and POSIX-like semantics, mounted by many machines over the network (NFS, SMB). Good for shared content and legacy apps. Examples: Amazon EFS, NetApp." },
              { title: "Object storage", text: "A flat namespace of objects, each with a key, data and metadata, accessed over HTTP (PUT, GET, DELETE). Virtually unlimited scale and very cheap per GB, but higher latency and no in-place edits. Examples: Amazon S3, Google Cloud Storage, MinIO." },
            ],
          },
          {
            type: "table",
            head: ["Aspect", "Block", "File", "Object"],
            rows: [
              ["Interface", "Disk device", "Mounted filesystem", "HTTP API"],
              ["Shared across servers", "Usually no", "Yes", "Yes, from anywhere"],
              ["Latency", "Sub-millisecond", "Low milliseconds", "Tens of milliseconds"],
              ["Scale", "Terabytes per volume", "Large", "Practically unlimited"],
              ["Updates", "Any byte, in place", "Any byte, in place", "Replace the whole object"],
              ["Cost per GB", "Highest", "Medium", "Lowest"],
              ["Typical use", "Database files, OS disks", "Shared home dirs, CMS uploads", "Media, backups, logs, data lakes"],
            ],
          },
        ],
      },
      {
        id: "object-storage-in-practice",
        heading: "Using S3-style storage in designs",
        blocks: [
          { type: "p", text: "In almost any design with user uploads, the pattern is: blobs go to object storage, **metadata** (owner, size, key, created time) goes to the database, and a CDN serves reads. S3 is designed for 11 nines of durability by storing data redundantly across multiple availability zones, and since late 2020 it provides strong read-after-write consistency for all operations." },
          {
            type: "list",
            items: [
              "**Presigned URLs:** the backend generates a short-lived signed URL and the client uploads directly to S3. Large files never pass through your app servers.",
              "**Multipart upload:** large files are uploaded in parallel parts and can resume after a failure. Recommended for anything above about 100 MB.",
              "**Lifecycle rules and storage classes:** move old objects to infrequent-access or archival tiers (Glacier) automatically to cut cost.",
              "**Event notifications:** an upload can trigger a queue message or function, for example to generate thumbnails or scan for malware.",
            ],
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant C as Client
  participant A as App Server
  participant S as Object Storage
  participant D as Database
  C->>A: POST /uploads request upload URL
  A->>D: insert media row with status pending
  A-->>C: presigned PUT URL valid 10 minutes
  C->>S: PUT file bytes directly
  S-->>A: upload event notification
  A->>D: mark media row ready`,
            caption: "Direct-to-storage upload with a presigned URL. The app server handles only small control messages.",
          },
          {
            type: "tradeoff",
            question: "Storing user profile photos: in the database as BLOBs or in object storage?",
            a: "Database BLOBs: transactional with the user row and one fewer system, but bloats the database, slows backups and replication, and makes CDN caching awkward.",
            b: "Object storage with a key in the database: cheap, scales without limit, CDN-friendly, at the cost of keeping two systems consistent.",
            verdict: "Object storage. Keep only the object key and metadata in the database. Handle orphans with a pending status and a periodic cleanup job.",
          },
        ],
      },
      {
        id: "how-search-works",
        heading: "How full-text search works",
        blocks: [
          { type: "p", text: "A query like `WHERE title LIKE '%running shoes%'` scans every row and cannot rank results or handle variations like run versus running. Search engines solve this in two steps: analyzing text into terms at index time, and looking up terms in an inverted index at query time." },
          {
            type: "list",
            ordered: true,
            items: [
              "**Tokenization:** split text into tokens. Nike Running Shoes for Men becomes nike, running, shoes, for, men.",
              "**Normalization:** lowercase, strip accents, and optionally remove stop words like for and the.",
              "**Stemming or lemmatization:** reduce words to a root so running, runs and ran can match run. Language-specific analyzers handle this.",
              "**Synonyms and n-grams (optional):** map sneakers to shoes, or index partial words for autocomplete.",
              "**Inverted index:** for each term, store a posting list of document ids, with positions and frequencies. A query for running shoes analyzes the query the same way, fetches the posting lists for run and shoe, and combines them.",
            ],
          },
          { type: "p", text: "**Relevance** decides the order of results. Elasticsearch uses **BM25** by default, which scores a document higher when a query term appears often in it (term frequency, with diminishing returns), when the term is rare across all documents (inverse document frequency, so shoes counts less than a rare brand name), and when the matching field is short (a match in a 5-word title beats one in a 2,000-word description). Production systems layer business signals on top, such as popularity, ratings, stock availability and personalization." },
        ],
      },
      {
        id: "elasticsearch",
        heading: "Elasticsearch basics and keeping it in sync",
        blocks: [
          { type: "p", text: "Elasticsearch (and its fork OpenSearch) stores JSON **documents** in an **index**. Each index is split into **primary shards** spread across nodes, and each primary has **replica shards** for failover and extra read capacity. A query is sent to one copy of every shard, and the results are merged and ranked. Writes become searchable after a **refresh**, every 1 second by default, which is why it is called near real-time." },
          { type: "callout", tone: "warning", title: "Not your source of truth", text: "Treat Elasticsearch as a derived, rebuildable index. It lacks multi-document transactions, and recovering from mapping mistakes often means reindexing. Keep the authoritative data in your primary database and make sure you can rebuild the search index from it." },
          {
            type: "diagram",
            chart: `graph LR
  APP["Product Service"] -->|"writes"| DB[("PostgreSQL")]
  DB -->|"WAL or binlog"| CDC["Debezium CDC"]
  CDC --> K[["Kafka topic products"]]
  K --> IDX["Indexer Service"]
  IDX -->|"bulk upsert"| ES{{"Elasticsearch"}}
  U(["User search"]) --> API["Search API"]
  API --> ES`,
            caption: "Change data capture keeps the search index in sync without the application writing to two systems.",
          },
          {
            type: "tradeoff",
            question: "How should product updates reach Elasticsearch: dual writes from the app or change data capture?",
            a: "Dual write: the service writes to the database, then to Elasticsearch. Simple, but if the second write fails or the process crashes between them, the index silently drifts.",
            b: "CDC or the outbox pattern: changes are captured from the database log (or an outbox table written in the same transaction) and streamed through Kafka to an indexer.",
            verdict: "CDC or outbox. The database commit is the single source of truth, every change is eventually indexed, and the pipeline can be replayed. Accept a lag of a second or two and use dual writes only for prototypes.",
          },
          { type: "p", text: "Two practical details make the pipeline robust. Make indexing **idempotent** by using the database primary key as the document id, so a replayed event simply overwrites. Use the row's version or update timestamp with external versioning, so an older event arriving late cannot overwrite a newer document." },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Blobs in object storage with metadata in the database, uploads via presigned URLs and reads via a CDN. For search, a clear explanation of the inverted index and analysis, Elasticsearch positioned as a secondary index, and a reliable sync path (CDC or outbox through a queue) with an honest note about indexing lag.",
          },
        ],
      },
    ],
  },
];
