import type { Article } from "../types";

export const FUNDAMENTALS_COMMS: Article[] = [
  {
    slug: "how-the-web-works",
    title: "How the Web Works",
    level: "basic",
    summary: "What actually happens between typing a URL and seeing a page, and where every millisecond of that journey goes.",
    tags: ["networking", "dns", "latency"],
    sections: [
      {
        id: "client-server",
        heading: "The client-server model",
        blocks: [
          {
            type: "p",
            text: "Almost every system you will design in an interview is a variation of one idea: a **client** asks for something and a **server** answers. The client might be a browser, a mobile app or another backend service. The server is a process listening on a port, usually behind several layers of infrastructure. The client starts the conversation, the server responds, and in plain HTTP the server never speaks first.",
          },
          {
            type: "p",
            text: "Two properties of this model drive most design decisions. First, servers are shared: thousands of clients hit the same fleet, so the server side must scale horizontally. Second, clients are far away and unreliable: networks drop packets, phones switch from Wi-Fi to 4G, and users close tabs mid-request. Good designs assume both.",
          },
          {
            type: "cards",
            items: [
              { title: "Client", text: "Initiates requests, renders results, holds little authoritative state. Can cache aggressively but cannot be trusted for validation or security." },
              { title: "Server", text: "Owns the data and business rules. Should be **stateless** where possible so any instance can serve any request and you can add instances freely." },
              { title: "Network in between", text: "DNS, routers, load balancers, proxies and CDNs. Each hop adds latency and a possible failure point, and each is also a place to cache or filter." },
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Stateless does not mean the system has no state. It means the state lives in a shared store (database, Redis) instead of in a particular server's memory. In a Spring Boot app, storing a user's cart in `HttpSession` on one node is the classic example of hidden server state that breaks when you scale out.",
          },
        ],
      },
      {
        id: "dns-resolution",
        heading: "DNS resolution step by step",
        blocks: [
          {
            type: "p",
            text: "Computers route packets by IP address, but humans type names. The **Domain Name System** is a distributed, hierarchical, heavily cached directory that translates `api.example.com` into an address like `203.0.113.10`. No single server knows every name. Instead, each level knows who is responsible for the level below it.",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "**Browser cache:** the browser checks whether it resolved this name recently and the TTL has not expired.",
              "**OS cache:** the operating system's stub resolver checks its own cache and the hosts file.",
              "**Recursive resolver:** the query goes to a resolver run by your ISP, your company or a public provider such as 8.8.8.8 or 1.1.1.1. If it has a cached answer, it returns immediately. Most lookups end here.",
              "**Root servers:** on a cache miss the resolver asks a root server, which does not know the answer but replies with the servers for the `.com` top-level domain.",
              "**TLD servers:** the `.com` servers reply with the **authoritative name servers** for `example.com`.",
              "**Authoritative server:** this server holds the actual records and returns the A (IPv4) or AAAA (IPv6) record, possibly after following a CNAME.",
              "**Caching on the way back:** the resolver caches the answer for the record's TTL and hands it to the OS and browser, which cache it too.",
            ],
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant B as Browser
  participant R as Recursive Resolver
  participant Root as Root Server
  participant T as TLD Server
  participant A as Authoritative Server
  B->>R: Where is api.example.com
  R->>Root: Where is api.example.com
  Root-->>R: Ask the .com servers
  R->>T: Where is api.example.com
  T-->>R: Ask ns1.example.com
  R->>A: Where is api.example.com
  A-->>R: 203.0.113.10 with TTL 300
  R-->>B: 203.0.113.10`,
            caption: "A full DNS lookup on a cold cache. With warm caches, the resolver answers in one round trip.",
          },
          {
            type: "tradeoff",
            question: "Short or long DNS TTL?",
            a: "Short TTL (30 to 60 seconds): you can fail over or shift traffic quickly, but resolvers query you more often and users pay lookup latency more often.",
            b: "Long TTL (hours): fewer lookups and faster page loads, but a bad record or a dead IP lingers in caches long after you fix it.",
            verdict: "Use short TTLs for records you may need to move (load balancer endpoints, failover targets) and long TTLs for stable ones. Lower the TTL days before a planned migration.",
          },
          {
            type: "p",
            text: "DNS is also a load distribution tool. An authoritative server can return several IPs (round robin DNS) or return different IPs based on the client's location (**GeoDNS**). It is coarse, because clients cache answers and you cannot control how long, but it is how traffic is often spread across regions before a load balancer ever sees it.",
          },
        ],
      },
      {
        id: "request-lifecycle",
        heading: "The lifecycle of an HTTP request",
        blocks: [
          {
            type: "p",
            text: "Once the client has an IP address, the real request begins. Walking through these steps out loud is a strong way to open a design discussion, because each step is a place where you can add caching, security or scaling later.",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "**TCP connection:** the client opens a TCP connection to port 443 with a three-way handshake (one round trip).",
              "**TLS handshake:** client and server agree on keys and the server proves its identity with a certificate (one round trip in TLS 1.3).",
              "**Request sent:** the client sends an HTTP request with a method, path, headers and an optional body.",
              "**Edge and load balancer:** the request may hit a CDN, then a load balancer, which picks a healthy backend instance.",
              "**Application:** the server parses the request, authenticates it, runs business logic, and calls caches, databases or other services.",
              "**Response:** the server returns a status code, headers and body. The client renders it and may fire off further requests for scripts, images and API data.",
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  U(["Browser"]) -->|"resolve name"| DNS{{"DNS"}}
  U -->|"HTTPS request"| CDN{{"CDN Edge"}}
  CDN -->|"cache miss"| LB["Load Balancer"]
  LB --> APP1["App Server"]
  LB --> APP2["App Server"]
  APP1 --> RC{{"Redis"}}
  APP1 --> DB[("Database")]
  APP2 --> DB`,
            caption: "The typical path of a request through a web system.",
          },
          {
            type: "code",
            lang: "http",
            code: `GET /api/v1/orders/42 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOi...
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, max-age=0

{"id": 42, "status": "SHIPPED", "total": 1499}`,
            caption: "A minimal request and response. Everything else in the web stack exists to deliver this exchange fast and safely.",
          },
        ],
      },
      {
        id: "latency-sources",
        heading: "Where latency comes from",
        blocks: [
          {
            type: "p",
            text: "Latency is rarely one big thing. It is the sum of many small waits, and the biggest ones are usually **round trips**, not computation. Light in fibre travels roughly 200 km per millisecond, so a round trip from Mumbai to a server in Virginia costs around 180 to 200 ms before any work is done. Every handshake multiplies that cost.",
          },
          {
            type: "table",
            head: ["Source", "Typical cost", "How to reduce it"],
            rows: [
              ["DNS lookup (cold)", "20 to 120 ms", "Caching, longer TTLs, DNS prefetch"],
              ["TCP handshake", "1 RTT", "Keep-alive, connection pooling"],
              ["TLS handshake", "1 RTT (TLS 1.3)", "TLS 1.3, session resumption, terminate TLS at the edge"],
              ["Physical distance", "Tens to hundreds of ms per RTT", "CDNs, multi-region deployment"],
              ["Server processing", "1 to 100+ ms", "Caching, better queries, async work"],
              ["Database query", "Sub-ms to seconds", "Indexes, read replicas, caching"],
              ["Payload transfer", "Depends on size and bandwidth", "Compression, pagination, smaller images"],
            ],
          },
          {
            type: "p",
            text: "Also distinguish **latency** (how long one request takes) from **throughput** (how many requests per second the system handles). You can raise throughput by adding servers without improving latency at all. Interviewers like to hear you talk about **p99** latency rather than averages, because the slowest 1 percent of requests is what users complain about, and in a page that makes 50 backend calls, almost every page load hits at least one tail-latency call.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Can you narrate a request end to end without hand-waving: DNS, TCP, TLS, load balancer, app, data store, response? Do you know that round trips dominate latency and that caching and geography are the main levers? Mentioning p99 instead of averages, and knowing that DNS TTLs affect failover speed, signals real production awareness.",
          },
        ],
      },
    ],
  },
  {
    slug: "tcp-udp-and-http",
    title: "TCP, UDP and HTTP",
    level: "basic",
    summary: "The transport protocols under every API call, how HTTP evolved from 1.1 to 3, and what TLS adds on top.",
    tags: ["tcp", "udp", "http", "tls"],
    sections: [
      {
        id: "tcp-vs-udp",
        heading: "TCP vs UDP",
        blocks: [
          {
            type: "p",
            text: "Both TCP and UDP sit on top of IP, which only promises best-effort delivery of individual packets. The two protocols make very different promises on top of that.",
          },
          {
            type: "p",
            text: "**TCP** gives you a reliable, ordered byte stream. It numbers every byte, retransmits anything that is not acknowledged, reorders out-of-order segments, and slows down when the network is congested (congestion control) or the receiver is overwhelmed (flow control). The price is extra round trips to set up the connection and stalls when a packet is lost, because later data waits for the missing piece.",
          },
          {
            type: "p",
            text: "**UDP** gives you almost nothing: send a datagram, and it may arrive, arrive twice, or never arrive. There is no connection, no ordering, no retransmission. That sounds bad, but it means zero setup cost and no waiting on lost packets, which is exactly what real-time media and games want. If a video frame is lost, retransmitting it 200 ms later is useless.",
          },
          {
            type: "table",
            head: ["Property", "TCP", "UDP"],
            rows: [
              ["Connection setup", "Three-way handshake", "None"],
              ["Reliability", "Guaranteed delivery with retransmits", "Best effort"],
              ["Ordering", "In order", "No ordering"],
              ["Congestion control", "Built in", "Up to the application"],
              ["Header size", "20 bytes minimum", "8 bytes"],
              ["Typical uses", "HTTP/1.1, HTTP/2, databases, SSH, email", "DNS, video calls, gaming, QUIC (HTTP/3)"],
            ],
          },
          {
            type: "tradeoff",
            question: "TCP or UDP for a real-time multiplayer game or video call?",
            a: "TCP: simpler, every update arrives, but one lost packet stalls everything behind it.",
            b: "UDP: lowest latency, stale data can simply be dropped, but you build any reliability you need yourself.",
            verdict: "UDP (often via WebRTC or a custom protocol) for state that is quickly superseded, like positions and audio. Use TCP for things that must arrive, like chat messages and purchases.",
          },
        ],
      },
      {
        id: "handshakes",
        heading: "Handshakes and why they cost so much",
        blocks: [
          {
            type: "p",
            text: "A TCP connection begins with a **three-way handshake**: the client sends SYN, the server replies SYN-ACK, and the client sends ACK. The client can send its request along with the final ACK, so the cost is one full round trip before any data flows. HTTPS then adds a TLS handshake on top.",
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: SYN
  S-->>C: SYN-ACK
  C->>S: ACK
  Note over C,S: TCP ready after 1 RTT
  C->>S: TLS ClientHello with key share
  S-->>C: ServerHello, certificate, Finished
  C->>S: Finished plus GET /feed
  S-->>C: 200 OK with feed data`,
            caption: "TCP plus TLS 1.3: two round trips before the first byte of the response. TLS 1.2 needed one more.",
          },
          {
            type: "p",
            text: "Two round trips may not sound like much, but on a 150 ms mobile link that is 300 ms of pure waiting per new connection. This is why connection reuse matters so much and why protocols keep trying to fold handshakes together.",
          },
        ],
      },
      {
        id: "http-versions",
        heading: "HTTP/1.1, HTTP/2 and HTTP/3",
        blocks: [
          {
            type: "p",
            text: "**HTTP/1.1** is text-based and handles one request at a time per connection. A connection can be reused (keep-alive), but a slow response blocks every request queued behind it on that connection. Browsers work around this by opening about six parallel connections per host, which multiplies handshake cost.",
          },
          {
            type: "p",
            text: "**HTTP/2** keeps the same semantics (methods, headers, status codes) but changes the wire format to binary frames. Its key feature is **multiplexing**: many requests and responses share one TCP connection as interleaved streams, so a slow response no longer blocks others at the HTTP layer. It also compresses headers with HPACK. The remaining problem is **TCP head-of-line blocking**: if one packet is lost, TCP holds back all streams until it is retransmitted, because TCP only knows about one ordered byte stream.",
          },
          {
            type: "p",
            text: "**HTTP/3** fixes that by running on **QUIC**, a transport built on UDP. QUIC implements reliability and congestion control per stream, so a lost packet only stalls the stream it belongs to. It merges the transport and TLS 1.3 handshakes into one round trip, supports 0-RTT resumption for repeat visitors, and identifies connections by an ID rather than by IP and port, so a phone moving from Wi-Fi to mobile data can keep its connection.",
          },
          {
            type: "table",
            head: ["Feature", "HTTP/1.1", "HTTP/2", "HTTP/3"],
            rows: [
              ["Transport", "TCP", "TCP", "QUIC over UDP"],
              ["Format", "Text", "Binary frames", "Binary frames"],
              ["Requests per connection", "One at a time", "Many, multiplexed", "Many, multiplexed"],
              ["Head-of-line blocking", "HTTP and TCP level", "TCP level only", "Per stream only"],
              ["Header compression", "None", "HPACK", "QPACK"],
              ["Setup cost with TLS", "2 to 3 RTT", "2 to 3 RTT", "1 RTT, 0-RTT on resume"],
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Inside a data centre, gRPC uses HTTP/2 between services. HTTP/3 matters most on lossy, high-latency mobile networks, which is why it is common at CDN edges and for large consumer apps.",
          },
        ],
      },
      {
        id: "https-tls",
        heading: "HTTPS and TLS basics",
        blocks: [
          {
            type: "p",
            text: "**HTTPS** is HTTP sent over a **TLS** encrypted channel. TLS gives three guarantees: **confidentiality** (nobody on the path can read the data), **integrity** (nobody can modify it undetected) and **authentication** (the client knows it is talking to the real server, because the server presents a certificate signed by a certificate authority the client trusts).",
          },
          {
            type: "list",
            items: [
              "**Asymmetric crypto** (key exchange, certificate signatures) is used only during the handshake to agree on a shared secret.",
              "**Symmetric crypto** (such as AES-GCM) encrypts the actual traffic, because it is far cheaper.",
              "**TLS termination** is where traffic is decrypted. Often this happens at the load balancer or CDN so backends do not each manage certificates. Traffic behind it can be plain HTTP inside a trusted network or re-encrypted.",
              "**mTLS** (mutual TLS) makes the client present a certificate too. It is common for service-to-service authentication inside a service mesh.",
            ],
          },
          {
            type: "tradeoff",
            question: "Terminate TLS at the load balancer or at each service?",
            a: "At the load balancer: one place to manage certificates, the LB can read headers for L7 routing, and backends save CPU.",
            b: "End to end: traffic stays encrypted inside the network, which some compliance regimes require.",
            verdict: "Terminate at the edge by default, and re-encrypt (or use mTLS via a mesh) for internal hops when you handle payments, health data or anything regulated.",
          },
        ],
      },
      {
        id: "keep-alive",
        heading: "Keep-alive and connection pooling",
        blocks: [
          {
            type: "p",
            text: "Because handshakes are expensive, clients reuse connections. **HTTP keep-alive** (the default in HTTP/1.1) leaves the TCP connection open after a response so the next request skips the handshakes. On the server side, an idle timeout closes connections nobody is using so they do not hold memory forever.",
          },
          {
            type: "p",
            text: "Backend services apply the same idea through **connection pools**. Your Spring service's `RestTemplate` or `WebClient`, its JDBC pool (HikariCP) and its Redis client all keep a set of warm connections and lend them to requests. Pool size is a real tuning knob: too small and requests queue waiting for a connection, too large and you overwhelm the database with concurrent sessions.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Pick the right transport for the job and justify it: TCP for correctness, UDP for real-time media. Explain that HTTP/2 multiplexes over one connection but still suffers TCP head-of-line blocking, and that HTTP/3 solves it with QUIC. Know what TLS actually guarantees and where you would terminate it. Bringing up connection reuse when discussing latency shows you think about round trips, not just code.",
          },
        ],
      },
    ],
  },
  {
    slug: "api-design",
    title: "API Design",
    level: "basic",
    summary: "How to design clean, evolvable APIs: REST conventions, status codes, gRPC and GraphQL, pagination, versioning and idempotency.",
    tags: ["api", "rest", "grpc", "graphql"],
    sections: [
      {
        id: "rest-principles",
        heading: "REST principles that actually matter",
        blocks: [
          {
            type: "p",
            text: "In an interview, the API is the contract between your system and its clients, and it is usually the first concrete artifact you produce. **REST** is the default style: you model the domain as **resources** identified by URLs, and use standard HTTP methods to act on them.",
          },
          {
            type: "list",
            items: [
              "**Nouns, not verbs:** `POST /orders` instead of `POST /createOrder`. The method carries the verb.",
              "**Plural collections and nested ownership:** `GET /users/17/orders` lists one user's orders. Avoid nesting deeper than two levels.",
              "**Statelessness:** every request carries everything needed to process it, such as an auth token. The server keeps no per-client session between calls.",
              "**Safe and idempotent methods:** `GET` is safe (no side effects). `GET`, `PUT` and `DELETE` are idempotent (repeating them has the same effect as doing them once). `POST` is neither, which is why retries need special care.",
              "**Use HTTP semantics:** status codes, `Cache-Control`, `ETag` and `Location` headers already solve common problems. Do not reinvent them inside JSON bodies.",
            ],
          },
          {
            type: "code",
            lang: "bash",
            code: `curl -X POST https://api.example.com/v1/orders \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 6f1c2a9e-4b7d-4f0a-9c1e-2d3b4a5c6d7e" \\
  -d '{"productId": "p_981", "quantity": 2}'

# HTTP/1.1 201 Created
# Location: /v1/orders/ord_5521`,
            caption: "Creating a resource: POST to the collection, 201 with a Location header pointing at the new resource.",
          },
        ],
      },
      {
        id: "status-codes",
        heading: "Status codes",
        blocks: [
          {
            type: "p",
            text: "Status codes let clients, proxies and monitoring tools understand a response without parsing the body. A service that returns `200 OK` with `{\"error\": \"not found\"}` breaks retries, caching and alerting all at once.",
          },
          {
            type: "table",
            head: ["Code", "Meaning", "When to use it"],
            rows: [
              ["200 OK", "Success with a body", "Successful GET, or PUT/PATCH that returns the resource"],
              ["201 Created", "Resource created", "Successful POST, with a Location header"],
              ["204 No Content", "Success, no body", "Successful DELETE"],
              ["301 / 302", "Redirect", "Permanent vs temporary move"],
              ["304 Not Modified", "Cached copy is still valid", "Conditional GET with If-None-Match"],
              ["400 Bad Request", "Malformed input", "Validation failures"],
              ["401 Unauthorized", "Not authenticated", "Missing or invalid token"],
              ["403 Forbidden", "Authenticated but not allowed", "User lacks permission"],
              ["404 Not Found", "No such resource", "Unknown ID or path"],
              ["409 Conflict", "State conflict", "Duplicate username, version mismatch"],
              ["429 Too Many Requests", "Rate limited", "Include a Retry-After header"],
              ["500 / 502 / 503 / 504", "Server-side failure", "Bug, bad upstream, overloaded, upstream timeout"],
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "The 4xx vs 5xx split matters for retries. A client should generally not retry a 4xx (the request itself is wrong), but may retry a 503 or 504 with exponential backoff. 429 is the exception: retry, but only after the Retry-After delay.",
          },
        ],
      },
      {
        id: "rest-grpc-graphql",
        heading: "REST vs gRPC vs GraphQL",
        blocks: [
          {
            type: "p",
            text: "**gRPC** is a remote procedure call framework from Google. You define services and messages in a `.proto` file, generate client and server code in Java, Go and other languages, and calls travel as compact Protocol Buffers binary over HTTP/2. It supports streaming in both directions and enforces a strict schema. It is excellent between internal services and awkward for browsers, which need a proxy layer such as gRPC-Web.",
          },
          {
            type: "p",
            text: "**GraphQL** exposes a single endpoint and a typed schema. The client sends a query describing exactly which fields it wants, possibly spanning several related objects, and gets back exactly that shape. This avoids over-fetching (getting fields you do not need) and under-fetching (making several calls to assemble one screen). The cost moves to the server: resolving arbitrary queries efficiently, preventing very expensive queries, and avoiding N+1 database calls (usually with batching via a DataLoader).",
          },
          {
            type: "table",
            head: ["Aspect", "REST", "gRPC", "GraphQL"],
            rows: [
              ["Style", "Resources and HTTP methods", "Remote procedure calls", "Client-written queries on a schema"],
              ["Payload", "Usually JSON", "Protocol Buffers (binary)", "JSON"],
              ["Transport", "HTTP/1.1 or HTTP/2", "HTTP/2", "Usually HTTP POST"],
              ["Schema", "Optional (OpenAPI)", "Required (.proto)", "Required (SDL)"],
              ["HTTP caching", "Easy with GET and CDNs", "Hard", "Hard, needs persisted queries"],
              ["Streaming", "Limited", "Native, bidirectional", "Subscriptions"],
              ["Browser support", "Native", "Needs gRPC-Web proxy", "Native"],
              ["Best fit", "Public APIs, CRUD services", "Internal service-to-service calls", "Rich UIs aggregating many sources"],
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  WEB(["Web App"]) -->|"REST or GraphQL"| GW["API Gateway"]
  MOB(["Mobile App"]) -->|"REST or GraphQL"| GW
  GW -->|"gRPC"| US["User Service"]
  GW -->|"gRPC"| OS["Order Service"]
  OS -->|"gRPC"| PS["Payment Service"]
  US --> UDB[("Users DB")]
  OS --> ODB[("Orders DB")]`,
            caption: "A common mix: REST or GraphQL at the edge for clients, gRPC inside the network.",
          },
          {
            type: "tradeoff",
            question: "Which API style for a new product?",
            a: "REST everywhere: simple, cacheable, every developer knows it.",
            b: "GraphQL at the edge with gRPC internally: flexible clients and fast typed internal calls, but more tooling and operational complexity.",
            verdict: "Default to REST for public and simple APIs. Reach for gRPC for high-volume internal calls and GraphQL when many different clients need differently shaped views of the same data.",
          },
        ],
      },
      {
        id: "pagination",
        heading: "Pagination: offset vs cursor",
        blocks: [
          {
            type: "p",
            text: "Any endpoint that returns a list must be paginated, otherwise one large account can take the service down. There are two main approaches.",
          },
          {
            type: "p",
            text: "**Offset pagination** uses `?limit=20&offset=40`. It is easy to build and lets users jump to page 37. But the database still has to walk past all the skipped rows, so deep pages get slow, and if new rows are inserted while a user is paging, items shift and the user sees duplicates or misses rows.",
          },
          {
            type: "p",
            text: "**Cursor pagination** returns an opaque `next_cursor` token encoding the position of the last item, typically its sort key and ID. The next query becomes `WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT 20`, which uses an index and stays fast at any depth. Inserts do not cause skips or duplicates. The cost is that you can only move forward (or backward) one page at a time.",
          },
          {
            type: "tradeoff",
            question: "Offset or cursor pagination?",
            a: "Offset: page numbers, random access, trivial to implement, but slow and inconsistent on large or fast-changing data.",
            b: "Cursor: stable and fast at any depth, but no jumping to arbitrary pages.",
            verdict: "Cursor for feeds, timelines, logs and anything large or frequently updated. Offset is fine for small, slow-changing admin tables where page numbers are useful.",
          },
        ],
      },
      {
        id: "versioning-idempotency",
        heading: "Versioning and idempotency keys",
        blocks: [
          {
            type: "p",
            text: "**Versioning** lets you change an API without breaking clients you do not control, such as mobile apps that users never update. The most common approach is a path prefix (`/v1/orders`), which is obvious and easy to route. Alternatives are a header (`Accept: application/vnd.example.v2+json`) or a query parameter. Whatever you choose, prefer **additive changes**: adding an optional field is safe, renaming or removing one is breaking and needs a new version.",
          },
          {
            type: "p",
            text: "**Idempotency keys** solve the retry problem for non-idempotent operations. Suppose a client sends `POST /payments`, the server charges the card, and the response is lost to a network timeout. The client retries and the customer is charged twice. With an idempotency key, the client generates a unique ID (a UUID) per logical operation and sends it in a header. The server stores the key with the result. If the same key arrives again, the server returns the stored result instead of repeating the work.",
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant C as Client
  participant API as Payment API
  participant DB as Key Store
  C->>API: POST /payments with key K1
  API->>DB: Insert K1 if absent
  DB-->>API: Inserted
  API->>API: Charge card
  API->>DB: Save result for K1
  API--xC: Response lost in network
  C->>API: Retry POST /payments with key K1
  API->>DB: Lookup K1
  DB-->>API: Found stored result
  API-->>C: 201 Created, same payment`,
            caption: "The retry returns the original result instead of charging twice.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "The key check and the insert must be atomic, for example a unique constraint on the key column or a Redis `SET key value NX`. Otherwise two concurrent retries can both see the key as missing and both execute. Keys usually expire after 24 hours or so.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A clean resource model with correct methods and status codes, cursor pagination on any list that can grow, a stated versioning strategy, and idempotency keys on anything that moves money or creates records. Being able to say why you chose REST, gRPC or GraphQL for each boundary, rather than just naming one, is what separates a good answer from a memorised one.",
          },
        ],
      },
    ],
  },
  {
    slug: "real-time-communication",
    title: "Real-Time Communication",
    level: "intermediate",
    summary: "Short polling, long polling, server-sent events, WebSockets and webhooks: how each works and how to pick one.",
    tags: ["websockets", "sse", "polling", "webhooks"],
    sections: [
      {
        id: "the-problem",
        heading: "The problem: servers cannot start conversations",
        blocks: [
          {
            type: "p",
            text: "Plain HTTP is request-response: the client asks, the server answers. But many features need the server to tell the client something the moment it happens: a new chat message, a driver's location, a stock price, a build finishing. Every technique in this chapter is a different way of getting data from server to client without waiting for the client to ask at the right moment.",
          },
          {
            type: "cards",
            items: [
              { title: "Short polling", text: "Client asks repeatedly on a timer. Simplest, most wasteful." },
              { title: "Long polling", text: "Client asks, server holds the request open until there is data or a timeout." },
              { title: "Server-sent events", text: "One long-lived HTTP response that the server keeps writing events into. Server to client only." },
              { title: "WebSockets", text: "A persistent, full-duplex connection upgraded from HTTP. Both sides send at any time." },
              { title: "Webhooks", text: "Server-to-server: your system calls a URL the other party registered when an event occurs." },
            ],
          },
        ],
      },
      {
        id: "polling",
        heading: "Short polling and long polling",
        blocks: [
          {
            type: "p",
            text: "**Short polling** is a loop: every N seconds the client sends `GET /notifications?since=...`. Most responses are empty. It works through every proxy and firewall and needs no special server support, but it wastes requests and adds up to N seconds of delay. With a million clients polling every 5 seconds, that is 200,000 requests per second, mostly returning nothing.",
          },
          {
            type: "p",
            text: "**Long polling** keeps the same request shape but the server does not answer immediately. It holds the request open until new data arrives or a timeout (say 30 seconds) passes, then responds. The client processes the response and immediately sends the next request. Latency is near real-time and empty responses are rare, but each waiting client ties up a connection, and the server needs an efficient way to wake the right held request when data arrives.",
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: GET /messages?after=100
  Note over S: Hold request, no new data yet
  S-->>C: 200 with message 101
  C->>S: GET /messages?after=101
  Note over S: Nothing for 30 seconds
  S-->>C: 204 No Content after timeout
  C->>S: GET /messages?after=101`,
            caption: "Long polling: one outstanding request per client at all times.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "Holding thousands of open requests is cheap on an event-driven server (Netty, Spring WebFlux, Node.js) and expensive on a classic thread-per-request server like default Tomcat, where every held request occupies a thread.",
          },
        ],
      },
      {
        id: "sse-websockets",
        heading: "Server-sent events and WebSockets",
        blocks: [
          {
            type: "p",
            text: "**Server-sent events (SSE)** use a normal HTTP request whose response has `Content-Type: text/event-stream` and never ends. The server writes small text events into it as they happen. The browser's `EventSource` API reconnects automatically and sends a `Last-Event-ID` header so the server can resume where it left off. SSE is one-way (server to client), text only, and works well over HTTP/2. Over HTTP/1.1, browsers limit open connections per domain to about six, which matters if a user opens many tabs.",
          },
          {
            type: "code",
            lang: "http",
            code: `GET /scores/stream HTTP/1.1
Accept: text/event-stream

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

id: 41
event: score
data: {"match": "IND-AUS", "runs": 182, "wickets": 3}

id: 42
event: score
data: {"match": "IND-AUS", "runs": 186, "wickets": 3}`,
            caption: "An SSE stream: the response stays open and events keep arriving.",
          },
          {
            type: "p",
            text: "**WebSockets** start as an HTTP request with `Upgrade: websocket`. The server replies `101 Switching Protocols`, and from then on the same TCP connection carries a lightweight framed protocol in both directions. Either side can send text or binary messages at any moment with very little overhead per message. This is the right tool for chat, collaborative editing and multiplayer features where the client sends frequently too.",
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant C as Client
  participant S as Chat Server
  C->>S: GET /chat with Upgrade websocket
  S-->>C: 101 Switching Protocols
  C->>S: send hello room 7
  S-->>C: message from Priya
  S-->>C: message from Arjun
  C->>S: send typing indicator
  C->>S: close
  S-->>C: close acknowledged`,
            caption: "After the upgrade, messages flow freely in both directions on one connection.",
          },
          {
            type: "p",
            text: "WebSockets make servers **stateful**: a given user is connected to one specific server. That has consequences. Load balancers must support long-lived connections. To deliver a message to a user, you need to know which server holds their connection, usually via a registry in Redis or a pub/sub layer that every chat server subscribes to. Deployments must drain connections gracefully, and clients must reconnect with backoff and resync anything they missed.",
          },
          {
            type: "tradeoff",
            question: "SSE or WebSockets for a live notifications feed?",
            a: "SSE: plain HTTP, automatic reconnect and resume, works with existing proxies and auth, but one-way only.",
            b: "WebSockets: bidirectional and binary-capable, but more infrastructure work and you build reconnect logic yourself.",
            verdict: "SSE when the server pushes and the client only reads (notifications, live scores, dashboards, streaming LLM output). WebSockets when the client also sends frequently (chat, games, collaborative editing).",
          },
        ],
      },
      {
        id: "webhooks",
        heading: "Webhooks",
        blocks: [
          {
            type: "p",
            text: "Everything above is about browsers and apps. **Webhooks** solve the same push problem between servers. Instead of your backend polling a payment provider to ask whether a payment succeeded, you register a callback URL with the provider and it sends an HTTP POST to that URL when the event happens.",
          },
          {
            type: "diagram",
            chart: `graph LR
  PSP["Payment Provider"] -->|"POST payment.succeeded"| WH["Webhook Endpoint"]
  WH -->|"verify signature"| WH
  WH -->|"enqueue"| Q[["Event Queue"]]
  WH -->|"200 OK fast"| PSP
  Q --> W["Worker"]
  W --> DB[("Orders DB")]`,
            caption: "A robust webhook receiver acknowledges quickly and processes asynchronously.",
          },
          {
            type: "list",
            items: [
              "**Verify the sender:** check an HMAC signature header computed with a shared secret, so attackers cannot forge events.",
              "**Respond fast:** return 2xx within a few seconds and do the real work from a queue, or the sender will time out and retry.",
              "**Expect duplicates and disorder:** senders retry on failure, so handle each event idempotently using its event ID, and do not assume events arrive in order.",
              "**Have a fallback:** if your endpoint was down for hours, reconcile by polling the provider's API for missed events.",
            ],
          },
        ],
      },
      {
        id: "choosing",
        heading: "When to use which",
        blocks: [
          {
            type: "table",
            head: ["Technique", "Direction", "Latency", "Server cost", "Good for"],
            rows: [
              ["Short polling", "Client pulls", "Up to the poll interval", "High wasted requests", "Low-frequency updates, quick prototypes"],
              ["Long polling", "Client pulls, server waits", "Near real-time", "One held request per client", "Fallback when WebSockets are blocked"],
              ["SSE", "Server to client", "Real-time", "One open response per client", "Feeds, notifications, live scores, streaming text"],
              ["WebSockets", "Both ways", "Real-time", "One stateful connection per client", "Chat, gaming, collaboration, trading UIs"],
              ["Webhooks", "Server to server", "Near real-time", "One request per event", "Payment and integration callbacks"],
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Do not reach for WebSockets by reflex. Justify the choice from the traffic pattern: who sends, how often, and how fresh the data must be. Then show you understand the operational cost of persistent connections: how many connections one server holds, how a message finds the server holding the recipient's connection (pub/sub or a connection registry), and how clients reconnect and catch up. For webhooks, mention signature verification and idempotent handling.",
          },
        ],
      },
    ],
  },
  {
    slug: "load-balancing",
    title: "Load Balancing",
    level: "basic",
    summary: "How load balancers spread traffic across servers, the difference between L4 and L7, the main algorithms and how to keep the balancer itself from being a single point of failure.",
    tags: ["load-balancer", "scaling", "availability"],
    sections: [
      {
        id: "why-load-balance",
        heading: "Why load balancers exist",
        blocks: [
          {
            type: "p",
            text: "Once one server is not enough, you run several and need something in front of them that decides which one handles each request. A **load balancer** does that, and in doing so gives you three things: **scalability** (add servers to add capacity), **availability** (stop sending traffic to a dead server) and **zero-downtime deploys** (drain a server, update it, put it back).",
          },
          {
            type: "diagram",
            chart: `graph TD
  C(["Clients"]) --> DNS{{"DNS"}}
  DNS --> LB1["Load Balancer Primary"]
  LB1 -.->|"failover"| LB2["Load Balancer Standby"]
  LB1 --> S1["App Server 1"]
  LB1 --> S2["App Server 2"]
  LB1 --> S3["App Server 3"]
  S1 --> DB[("Database")]
  S2 --> DB
  S3 --> DB`,
            caption: "A load balancer pair in front of a stateless app tier.",
          },
          {
            type: "p",
            text: "Load balancers appear at many layers: in front of the web tier, between internal services, and in front of database read replicas. In cloud interviews it is fine to say AWS ALB or NLB, GCP Load Balancing, or self-managed Nginx, HAProxy or Envoy.",
          },
        ],
      },
      {
        id: "l4-vs-l7",
        heading: "L4 vs L7 load balancing",
        blocks: [
          {
            type: "p",
            text: "The layer numbers come from the OSI model. A **Layer 4** balancer works with TCP and UDP connections. It sees IP addresses and ports, picks a backend when a connection opens, and forwards bytes without understanding them. A **Layer 7** balancer terminates the connection, parses the HTTP request, and can route on the path, headers, cookies or method.",
          },
          {
            type: "table",
            head: ["Aspect", "Layer 4", "Layer 7"],
            rows: [
              ["Sees", "IP, port, protocol", "Full HTTP request: URL, headers, cookies"],
              ["Routing decisions", "Per connection", "Per request"],
              ["Speed", "Very fast, low overhead", "More CPU per request"],
              ["TLS", "Usually passes through", "Usually terminates"],
              ["Features", "Basic distribution", "Path routing, header rules, retries, auth, compression"],
              ["Protocols", "Any TCP or UDP traffic", "HTTP, HTTP/2, gRPC, WebSocket"],
              ["Examples", "AWS NLB, LVS, HAProxy in TCP mode", "AWS ALB, Nginx, Envoy"],
            ],
          },
          {
            type: "tradeoff",
            question: "L4 or L7 balancer?",
            a: "L4: highest throughput and lowest latency, protocol-agnostic, but blind to request content.",
            b: "L7: smart routing such as `/api` to one pool and `/images` to another, but more expensive per request.",
            verdict: "L7 for most HTTP services because content-based routing is so useful. L4 for raw TCP or UDP workloads, extreme throughput, or as a first tier in front of a fleet of L7 balancers.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "HTTP/2 and gRPC keep one long-lived connection open. An L4 balancer pins that connection to one backend, so all requests from that client land on one server and load becomes uneven. An L7 balancer that understands HTTP/2 can spread individual requests.",
          },
        ],
      },
      {
        id: "algorithms",
        heading: "Load balancing algorithms",
        blocks: [
          {
            type: "cards",
            items: [
              { title: "Round robin", text: "Send requests to servers in turn. Simple and fair when servers are identical and requests cost about the same." },
              { title: "Weighted round robin", text: "Servers with weight 3 get three times the traffic of weight 1. Useful for mixed hardware or canary releases at 5 percent." },
              { title: "Least connections", text: "Pick the server with the fewest active connections. Adapts to slow requests and long-lived connections such as WebSockets." },
              { title: "Least response time", text: "Favour servers that are both lightly loaded and responding fast. Needs the balancer to track latency." },
              { title: "IP hash", text: "Hash the client IP to pick a server, so the same client usually lands on the same server. Breaks badly when servers are added or removed." },
              { title: "Consistent hashing", text: "Place servers and keys on a hash ring. Adding or removing a server only remaps keys near it, roughly 1/N of them." },
            ],
          },
          {
            type: "p",
            text: "**Consistent hashing** deserves a closer look because it appears all over system design. With plain `hash(key) % N`, changing N from 4 to 5 remaps about 80 percent of keys, which is a disaster for caches. On a hash ring, each key belongs to the next server clockwise, so a new server only takes over keys from its neighbour. **Virtual nodes** (each server placed at many points on the ring) smooth out uneven distribution. Use it when the backend holds per-key state you want to keep warm: cache nodes, sharded storage, or WebSocket servers keyed by room.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "A useful middle ground is **power of two choices**: pick two servers at random and send the request to the less loaded one. It performs almost as well as global least connections without the balancer needing perfectly fresh load data, and Envoy and Nginx both support variants of it.",
          },
        ],
      },
      {
        id: "health-sticky",
        heading: "Health checks and sticky sessions",
        blocks: [
          {
            type: "p",
            text: "A balancer is only useful if it stops sending traffic to broken servers. **Active health checks** probe each backend on a schedule, for example `GET /health` every 5 seconds, and mark it unhealthy after a few consecutive failures. **Passive health checks** watch real traffic and eject a server that returns too many errors or timeouts. Most production setups use both.",
          },
          {
            type: "list",
            items: [
              "**Liveness vs readiness:** liveness asks whether the process is alive. Readiness asks whether it can serve traffic right now (connected to the database, caches warmed). The balancer should route on readiness. Spring Boot Actuator exposes both.",
              "**Do not make health checks too deep:** if every instance's check calls the database and the database blips, every instance fails at once and the balancer has nowhere to send traffic.",
              "**Connection draining:** before removing a server, stop sending new requests and let in-flight ones finish.",
            ],
          },
          {
            type: "p",
            text: "**Sticky sessions** (session affinity) send all requests from one client to the same server, usually via a cookie the balancer sets. It is a quick fix for apps that keep session data in memory. The cost: load becomes uneven, a server failure logs out everyone pinned to it, and scaling down is painful.",
          },
          {
            type: "tradeoff",
            question: "Sticky sessions or a shared session store?",
            a: "Sticky sessions: no code change for an app with in-memory sessions, but uneven load and lost sessions on failure.",
            b: "Externalise sessions to Redis or use stateless JWTs: any server can handle any request.",
            verdict: "Make the app stateless and keep sessions in a shared store. Use stickiness only as a performance hint (for local caches) or for protocols that genuinely need it, never as the only copy of user state.",
          },
        ],
      },
      {
        id: "lb-redundancy",
        heading: "Making the load balancer redundant",
        blocks: [
          {
            type: "p",
            text: "A single load balancer is a single point of failure, which interviewers will point out if you draw only one. Common answers:",
          },
          {
            type: "list",
            items: [
              "**Active-passive pair:** two balancers share a floating virtual IP. The standby monitors the primary with heartbeats (for example using VRRP via keepalived) and takes over the IP if the primary dies.",
              "**Active-active:** several balancers all serve traffic, with DNS returning multiple IPs or an upstream router spreading connections across them using ECMP.",
              "**Managed cloud balancers:** AWS ALB or GCP's balancer are already distributed across zones by the provider, so redundancy is handled for you.",
              "**Multi-region:** GeoDNS or anycast sends users to the nearest healthy region, each with its own balancers.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Place the load balancer correctly and say whether it is L4 or L7 and why. Pick an algorithm that fits the workload, such as least connections for long-lived connections or consistent hashing when servers hold per-key state, rather than defaulting to round robin. Mention health checks with readiness, avoid sticky sessions by keeping servers stateless, and never leave the balancer itself as a single point of failure.",
          },
        ],
      },
    ],
  },
  {
    slug: "proxies-and-api-gateways",
    title: "Proxies and API Gateways",
    level: "intermediate",
    summary: "Forward and reverse proxies, what an API gateway is responsible for, and how service meshes move networking concerns into sidecars.",
    tags: ["proxy", "api-gateway", "service-mesh"],
    sections: [
      {
        id: "forward-vs-reverse",
        heading: "Forward vs reverse proxy",
        blocks: [
          {
            type: "p",
            text: "A **proxy** is an intermediary that receives a request and forwards it on someone else's behalf. The difference between the two kinds is whose side it is on.",
          },
          {
            type: "p",
            text: "A **forward proxy** sits in front of **clients**. The client is configured to send its traffic through it, and destination servers see the proxy's IP instead of the client's. Companies use forward proxies to filter and log employee browsing, cache common downloads, or give a fleet of internal servers controlled outbound internet access through a single egress point.",
          },
          {
            type: "p",
            text: "A **reverse proxy** sits in front of **servers**. Clients think they are talking to the real service, but they are talking to the proxy, which forwards to one of many hidden backends. Nginx, HAProxy and Envoy are typical reverse proxies, and every load balancer, CDN edge and API gateway is a specialised one.",
          },
          {
            type: "diagram",
            chart: `graph LR
  C1(["Employee Laptop"]) --> FP["Forward Proxy"]
  C2(["Employee Laptop"]) --> FP
  FP -->|"internet"| RP["Reverse Proxy"]
  U(["Public User"]) --> RP
  RP --> B1["Backend A"]
  RP --> B2["Backend B"]`,
            caption: "A forward proxy represents clients. A reverse proxy represents servers.",
          },
          {
            type: "table",
            head: ["Aspect", "Forward proxy", "Reverse proxy"],
            rows: [
              ["Acts for", "Clients", "Servers"],
              ["Who configures it", "Client or client's network", "Service owner"],
              ["Hides", "Client identity", "Backend topology"],
              ["Typical uses", "Content filtering, egress control, anonymity", "Load balancing, TLS termination, caching, compression"],
              ["Examples", "Squid, corporate proxies", "Nginx, HAProxy, Envoy, CDNs"],
            ],
          },
        ],
      },
      {
        id: "reverse-proxy-jobs",
        heading: "What a reverse proxy does for you",
        blocks: [
          {
            type: "list",
            items: [
              "**TLS termination:** handle certificates and encryption in one place.",
              "**Load balancing:** spread requests across backend instances.",
              "**Caching and compression:** serve repeated responses from memory and gzip or brotli-compress text responses.",
              "**Security shield:** backends are not directly reachable, and the proxy can enforce request size limits, block bad IPs and absorb slow-client attacks.",
              "**Buffering slow clients:** the proxy reads the full request from a slow mobile client before handing it to the app, so app threads are not tied up waiting on a slow network.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Behind a reverse proxy, your app sees the proxy's IP as the client. The original IP travels in the `X-Forwarded-For` header (or the standard `Forwarded` header). Trust it only when it comes from your own proxy, since clients can set it themselves.",
          },
        ],
      },
      {
        id: "api-gateway",
        heading: "API gateway responsibilities",
        blocks: [
          {
            type: "p",
            text: "An **API gateway** is a reverse proxy that understands your APIs and acts as the single front door for many backend services. In a microservices system, it keeps every service from reimplementing the same cross-cutting logic, and it lets clients call one host instead of knowing about twenty services.",
          },
          {
            type: "cards",
            items: [
              { title: "Routing", text: "Map `/orders/**` to the order service and `/users/**` to the user service. Services can move without clients noticing." },
              { title: "Authentication", text: "Validate JWTs or API keys once at the edge and pass a trusted user identity downstream." },
              { title: "Rate limiting and quotas", text: "Protect backends and enforce per-client or per-plan limits, returning 429 when exceeded." },
              { title: "Request shaping", text: "Transform headers, translate REST to gRPC, or aggregate several backend calls into one response for a mobile screen." },
              { title: "Observability", text: "Central access logs, metrics and trace IDs injected into every request." },
              { title: "Resilience", text: "Timeouts, retries and circuit breaking so one slow service does not exhaust the gateway." },
            ],
          },
          {
            type: "diagram",
            chart: `graph LR
  M(["Mobile App"]) --> GW["API Gateway"]
  W(["Web App"]) --> GW
  GW --> AUTH["Auth Service"]
  GW --> RL{{"Rate Limit Store"}}
  GW --> ORD["Order Service"]
  GW --> CAT["Catalog Service"]
  GW --> USR["User Service"]`,
            caption: "The gateway centralises edge concerns so services can focus on business logic.",
          },
          {
            type: "p",
            text: "Popular choices include Kong, AWS API Gateway, Apigee, Envoy-based gateways and, in Java shops, Spring Cloud Gateway. A related pattern is **Backend for Frontend (BFF)**: a separate gateway per client type (one for mobile, one for web) so each can shape responses for its own screens.",
          },
          {
            type: "tradeoff",
            question: "Put logic in the gateway or keep it thin?",
            a: "Rich gateway: aggregation, transformations and business rules at the edge, fewer client round trips.",
            b: "Thin gateway: only routing, auth, rate limits and observability, with business logic in services.",
            verdict: "Keep it thin. A gateway full of business logic becomes a shared monolith that every team must change and deploy. Push aggregation into a BFF owned by the client team if you need it.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "The gateway is on every request path, so it must be horizontally scaled, deployed redundantly across zones, and kept fast. A gateway outage is a total outage.",
          },
        ],
      },
      {
        id: "service-mesh",
        heading: "Service mesh and sidecars",
        blocks: [
          {
            type: "p",
            text: "A gateway handles traffic entering the system (north-south). Inside, services call each other constantly (east-west), and each of those calls needs retries, timeouts, encryption, metrics and tracing too. Building that into every service in every language is repetitive and inconsistent.",
          },
          {
            type: "p",
            text: "A **service mesh** moves that logic out of application code into a **sidecar proxy** deployed next to every service instance, typically in the same Kubernetes pod. The service talks to `localhost`, and the sidecar handles the network: it discovers destinations, load balances, retries, encrypts with mTLS, and reports metrics. A **control plane** pushes configuration and certificates to all sidecars. Istio and Linkerd are the well-known meshes, and Envoy is the most common sidecar.",
          },
          {
            type: "diagram",
            chart: `graph LR
  CP[["Control Plane"]] -.->|"config and certs"| SA["Sidecar A"]
  CP -.->|"config and certs"| SB["Sidecar B"]
  A["Order Service"] --> SA
  SA -->|"mTLS"| SB
  SB --> B["Payment Service"]`,
            caption: "Services talk to their local sidecar. Sidecars talk to each other over mTLS.",
          },
          {
            type: "tradeoff",
            question: "Adopt a service mesh?",
            a: "Yes: uniform mTLS, retries and telemetry across every language, without touching application code.",
            b: "No: libraries like Resilience4j and a good gateway are enough, with less infrastructure to run.",
            verdict: "A mesh pays off with many services, several languages, and a platform team to run it. With a handful of Spring services, libraries are simpler and cheaper.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Clearly separate forward and reverse proxies by whose side they are on. List concrete gateway duties (routing, auth, rate limiting, observability) and recognise the gateway as a critical, must-be-redundant component. Knowing when a service mesh is worth its operational cost, rather than adding one to every diagram, shows maturity.",
          },
        ],
      },
    ],
  },
  {
    slug: "caching",
    title: "Caching",
    level: "basic",
    summary: "Where caches live, the read and write strategies that keep them in step with the database, how they evict and invalidate, and how they fail under load.",
    tags: ["caching", "redis", "performance"],
    sections: [
      {
        id: "cache-layers",
        heading: "Cache layers",
        blocks: [
          {
            type: "p",
            text: "A **cache** is a fast store holding copies of data that is expensive to fetch or compute. Reading from Redis takes well under a millisecond, while a database query with joins might take 20 ms or more. Caching works because access patterns are skewed: a small fraction of the data (popular products, active users, trending posts) receives most of the reads.",
          },
          {
            type: "diagram",
            chart: `graph LR
  U(["Browser Cache"]) --> CDN{{"CDN"}}
  CDN --> LB["Load Balancer"]
  LB --> APP["App with Local Cache"]
  APP --> DC{{"Redis Cluster"}}
  APP --> DB[("Database with Buffer Pool")]`,
            caption: "Caches exist at every hop. The closer to the user, the faster and the harder to invalidate.",
          },
          {
            type: "table",
            head: ["Layer", "Example", "Strength", "Weakness"],
            rows: [
              ["Client", "Browser HTTP cache, app memory", "Zero network cost", "You cannot purge it, only wait for expiry"],
              ["CDN", "Cloudflare, CloudFront, Akamai", "Close to users, absorbs huge traffic", "Best for public or shared content"],
              ["Application (local)", "Caffeine, Guava in the JVM", "Nanosecond access, no network", "Each instance has its own copy, so instances disagree"],
              ["Distributed", "Redis, Memcached", "Shared by all instances, scales out", "A network hop, another system to operate"],
              ["Database", "Buffer pool, query cache", "Automatic", "Limited control, competes with DB memory"],
            ],
          },
        ],
      },
      {
        id: "strategies",
        heading: "Read and write strategies",
        blocks: [
          {
            type: "p",
            text: "**Cache-aside** (lazy loading) is the most common pattern and the one to default to. The application checks the cache. On a miss, it reads the database, writes the result into the cache with a TTL, and returns it. The cache only ever holds data someone asked for, and if the cache dies, the app still works, just slower.",
          },
          {
            type: "code",
            lang: "java",
            code: `public Product getProduct(String id) {
    String key = "product:" + id;
    Product cached = redis.get(key);
    if (cached != null) {
        return cached;
    }
    Product fromDb = productRepository.findById(id).orElseThrow();
    redis.setex(key, 600 + random.nextInt(60), fromDb);
    return fromDb;
}

public void updateProduct(Product p) {
    productRepository.save(p);
    // delete rather than overwrite, so a racing reader cannot leave an older value behind
    redis.del("product:" + p.getId());
}`,
            caption: "Cache-aside in Java. The TTL is jittered so keys written together do not all expire together.",
          },
          {
            type: "cards",
            items: [
              { title: "Read-through", text: "The app only talks to the cache. On a miss, the cache itself loads from the database. Same behaviour as cache-aside, but the loading logic lives in the cache library or provider." },
              { title: "Write-through", text: "Every write goes to the cache and the database synchronously. Cache is always fresh, but writes are slower and you cache data that may never be read." },
              { title: "Write-back (write-behind)", text: "Writes go to the cache only, and are flushed to the database later in batches. Very fast writes, but data is lost if the cache fails before flushing." },
              { title: "Write-around", text: "Writes go straight to the database, skipping the cache. The cache fills only on reads. Good when written data is rarely read back soon." },
            ],
          },
          {
            type: "tradeoff",
            question: "Write-through or write-back?",
            a: "Write-through: cache and database always agree, no data loss on cache failure, but every write pays both latencies.",
            b: "Write-back: writes are as fast as memory and can be batched, but recent writes are lost if the cache node crashes.",
            verdict: "Write-through (or cache-aside with delete on write) for anything that must not be lost, like orders and balances. Write-back for high-volume data where small loss is acceptable, like view counters or analytics.",
          },
        ],
      },
      {
        id: "eviction",
        heading: "Eviction policies",
        blocks: [
          {
            type: "p",
            text: "Memory is finite, so when a cache is full it must choose what to throw away. The policy determines your **hit ratio**, the fraction of reads served from cache, which is the number that matters most.",
          },
          {
            type: "table",
            head: ["Policy", "Evicts", "Good for", "Watch out for"],
            rows: [
              ["LRU", "Least recently used item", "General workloads with recency bias", "A one-off scan of many keys flushes out genuinely hot data"],
              ["LFU", "Least frequently used item", "Stable popularity, such as top products", "Old popular items linger after they stop being popular"],
              ["FIFO", "Oldest inserted item", "Simplicity", "Ignores how often items are used"],
              ["TTL", "Items past their expiry time", "Bounding staleness", "Not a capacity policy by itself, combine with LRU or LFU"],
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Redis implements approximate LRU and LFU by sampling keys, configured with `maxmemory-policy` (for example `allkeys-lru` or `volatile-lfu`). Caffeine in Java uses W-TinyLFU, which blends recency and frequency and usually beats plain LRU.",
          },
        ],
      },
      {
        id: "invalidation",
        heading: "Invalidation and consistency",
        blocks: [
          {
            type: "p",
            text: "Every cache is a second copy of the truth, and the moment the database changes, the copy may be wrong. You choose how wrong and for how long.",
          },
          {
            type: "list",
            items: [
              "**TTL expiry:** every entry expires after N seconds. Simple and self-healing, but data can be stale for up to N seconds.",
              "**Delete on write:** after updating the database, delete the cache key so the next read reloads it. Deleting is safer than updating the cache, because two concurrent writers updating the cache in the wrong order can leave an old value in place.",
              "**Event-driven invalidation:** the database change stream (for example Debezium reading the MySQL binlog into Kafka) triggers cache deletes, which catches writes from every service, not just one.",
              "**Versioned keys:** include a version in the key (`user:17:v42`). A change bumps the version, and old entries simply age out.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Even delete-on-write has a race: a reader misses, reads the old row, the writer updates the row and deletes the key, then the reader writes its old value into the cache. A TTL bounds how long that stale value survives, which is why you should always set one. Some teams also do a second delayed delete a second or two later.",
          },
        ],
      },
      {
        id: "stampede-hot-keys",
        heading: "Cache stampede and hot keys",
        blocks: [
          {
            type: "p",
            text: "A **cache stampede** (thundering herd) happens when a popular key expires and thousands of concurrent requests miss at the same moment, all hit the database for the same row, and the database falls over. A related failure is a cold cache after a restart, when every key misses at once.",
          },
          {
            type: "diagram",
            chart: `graph LR
  R1(["Request 1"]) --> APP["App Server"]
  R2(["Request 2"]) --> APP
  R3(["Request 3"]) --> APP
  APP -->|"miss on hot key"| L{{"Lock in Redis"}}
  L -->|"only lock holder"| DB[("Database")]
  DB -->|"fill"| CACHE{{"Cache"}}
  APP -->|"others wait then reread"| CACHE`,
            caption: "Request coalescing: one request rebuilds the value, everyone else waits for it.",
          },
          {
            type: "list",
            items: [
              "**Request coalescing or locking:** on a miss, only the request that wins a short lock (Redis `SET key NX PX 5000`) rebuilds the value. Others wait briefly and reread, or get the stale value.",
              "**Serve stale while refreshing:** keep a logical expiry inside the value. When it passes, one background task refreshes while readers keep getting the old value.",
              "**Probabilistic early refresh:** each read has a small and growing chance of refreshing the key before it actually expires, so refreshes spread out.",
              "**TTL jitter:** add randomness to TTLs so keys loaded together do not expire together.",
            ],
          },
          {
            type: "p",
            text: "A **hot key** is a single key so popular that the one Redis shard holding it is overloaded, even though the cluster as a whole is idle. Think of a celebrity's profile or a flash sale product. Fixes include a small **local in-process cache** in front of Redis (even a 1 second TTL absorbs most of the load) and **key replication**: store copies as `product:42:1` through `product:42:8` on different shards and read a random one.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Say what you cache, where, and with which pattern, usually cache-aside with a TTL. State the consistency you accept (for example, up to 60 seconds stale on product details, never stale on balances). Then proactively raise failure modes: stampede on hot key expiry, hot key shard overload, and what happens when the cache is down. Quoting an expected hit ratio and how it reduces database load is a strong touch.",
          },
        ],
      },
    ],
  },
  {
    slug: "content-delivery-networks",
    title: "Content Delivery Networks",
    level: "basic",
    summary: "How CDNs serve content from edges close to users, how cache keys, TTLs and purging work, and the cases where a CDN does not help.",
    tags: ["cdn", "caching", "latency"],
    sections: [
      {
        id: "what-cdn-does",
        heading: "What a CDN does",
        blocks: [
          {
            type: "p",
            text: "A **Content Delivery Network** is a large, geographically spread fleet of caching reverse proxies, called **edge servers** or points of presence (PoPs). Users are routed to a nearby edge, usually via DNS or anycast. If the edge has the file, it serves it immediately. If not, it fetches from your **origin** (your servers or object storage like S3), stores a copy, and serves it.",
          },
          {
            type: "p",
            text: "The benefit is physics plus offload. A user in Chennai fetching an image from a Mumbai edge waits a few milliseconds instead of 200 ms for a US origin, and the origin serves that image once per edge instead of once per user. For a video platform or e-commerce site, a CDN often serves well over 90 percent of bytes.",
          },
          {
            type: "diagram",
            chart: `graph LR
  U1(["User in Delhi"]) --> E1{{"Edge Delhi"}}
  U2(["User in Chennai"]) --> E2{{"Edge Chennai"}}
  U3(["User in London"]) --> E3{{"Edge London"}}
  E1 -->|"miss"| SH{{"Regional Shield"}}
  E2 -->|"miss"| SH
  E3 -->|"miss"| ORG["Origin Server"]
  SH -->|"miss"| ORG
  ORG --> S3[("Object Storage")]`,
            caption: "Edges serve nearby users. A shield tier collapses misses from many edges into one origin request.",
          },
          {
            type: "cards",
            items: [
              { title: "Lower latency", text: "Content travels a short distance and TLS handshakes complete at a nearby edge." },
              { title: "Origin offload", text: "The origin handles a small fraction of traffic, so it can be smaller and cheaper." },
              { title: "Spike absorption", text: "A viral post or sale goes to thousands of edge servers instead of your app tier." },
              { title: "Security", text: "Edges absorb DDoS traffic and often run a web application firewall before requests reach you." },
            ],
          },
        ],
      },
      {
        id: "push-vs-pull",
        heading: "Push vs pull CDNs",
        blocks: [
          {
            type: "p",
            text: "In a **pull CDN**, the edge fetches content from the origin on the first request for it and caches it according to TTL. You change nothing except pointing your asset domain at the CDN. The first user in each region pays a miss, and unpopular content may never be cached at all.",
          },
          {
            type: "p",
            text: "In a **push CDN**, you upload content to the CDN's storage ahead of time, and the CDN distributes it. Nothing is fetched on demand, so there are no cold misses, but you are responsible for uploading, updating and deleting every file.",
          },
          {
            type: "tradeoff",
            question: "Push or pull?",
            a: "Pull: zero upload workflow, caches only what is actually requested, but the first request per edge is slow.",
            b: "Push: content is ready before anyone asks, ideal for known large files, but you manage the content lifecycle yourself.",
            verdict: "Pull is the default for websites, APIs and user-generated images. Push suits large, predictable releases such as a game patch, a software installer or a scheduled video premiere.",
          },
        ],
      },
      {
        id: "cache-keys-ttls",
        heading: "Cache keys and TTLs",
        blocks: [
          {
            type: "p",
            text: "The **cache key** decides when two requests are the same. By default it is roughly the host plus path plus query string. Getting it wrong causes either low hit ratios or, much worse, serving one user's content to another.",
          },
          {
            type: "list",
            items: [
              "**Strip noise from the key:** tracking parameters like `utm_source` create thousands of variants of the same page. Exclude them from the key.",
              "**Include what changes the response:** if responses differ by language or device type, those must be in the key, often through the `Vary` header. Vary on as little as possible, since `Vary: User-Agent` destroys hit ratios.",
              "**Never cache personalised responses publicly:** responses with user-specific data must be `Cache-Control: private` or `no-store`.",
            ],
          },
          {
            type: "p",
            text: "TTLs are controlled with response headers from the origin. `max-age` applies to browsers, `s-maxage` overrides it for shared caches like CDNs, and `stale-while-revalidate` lets the edge serve a slightly old copy while it fetches a fresh one in the background.",
          },
          {
            type: "code",
            lang: "http",
            code: `# fingerprinted static asset: cache for a year
GET /static/app.3f9a2c.js
Cache-Control: public, max-age=31536000, immutable

# product page: short CDN TTL, browsers always revalidate
GET /products/981
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=30

# user's cart: never cache in shared caches
GET /api/cart
Cache-Control: private, no-store`,
            caption: "Three common caching policies for three kinds of content.",
          },
          {
            type: "table",
            head: ["Content", "Typical TTL", "Why"],
            rows: [
              ["Fingerprinted JS, CSS, images", "1 year", "The URL changes when content changes, so the old URL never needs updating"],
              ["Product images, video segments", "Days to weeks", "Rarely change, large, heavily reused"],
              ["HTML pages, public API responses", "Seconds to minutes", "Change often but tolerate brief staleness"],
              ["Personalised or authenticated data", "Not cached at the edge", "Different for every user"],
            ],
          },
        ],
      },
      {
        id: "purging",
        heading: "Purging and versioning",
        blocks: [
          {
            type: "p",
            text: "When content changes before its TTL expires, you have two options. **Purging** (invalidation) tells the CDN to drop cached copies, by exact URL, by prefix, or by **surrogate key** (a tag attached to many responses, such as `product-981`, so one purge clears the product page, its API response and its thumbnails). Purges propagate across all edges, which typically takes from a second to a few minutes depending on the provider.",
          },
          {
            type: "p",
            text: "**Versioned URLs** avoid purging entirely. Build tools put a content hash in the filename (`app.3f9a2c.js`). A new deploy produces a new filename, the HTML references it, and the old file is simply never requested again. This is why static assets can safely have one-year TTLs.",
          },
          {
            type: "tradeoff",
            question: "Purge on change or version the URL?",
            a: "Purge: URLs stay stable, which suits HTML and API paths, but you depend on purge speed and must not forget to trigger it.",
            b: "Versioned URLs: instant and reliable updates with very long TTLs, but only works where something else (the HTML) references the URL.",
            verdict: "Version every static asset. Use short TTLs plus targeted purges for HTML and API responses that must keep a fixed URL.",
          },
        ],
      },
      {
        id: "when-cdn-does-not-help",
        heading: "When a CDN does not help",
        blocks: [
          {
            type: "list",
            items: [
              "**Personalised or real-time data:** a user's feed, cart or balance differs for every user and changes constantly. The edge can still terminate TLS and route over the provider's fast backbone, but it cannot cache.",
              "**Write-heavy traffic:** POST requests and uploads must reach the origin. A CDN cannot absorb them.",
              "**Long-tail content:** if most files are requested once or twice, as with old archives or rarely viewed user uploads, hit ratios stay low and you pay for the extra hop.",
              "**Users concentrated next to the origin:** if all users are in one city and so is the origin, the latency gain is small.",
              "**Strict consistency needs:** if users must always see the latest version instantly, caching at thousands of edges works against you.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Put static and media content behind a CDN early in any user-facing design, and explain what is cached and what is not. Show you can set sensible TTLs, use versioned filenames for static assets, and avoid caching private data. Mention the origin shield for protecting the origin, and be honest about where a CDN adds little, such as personalised APIs or long-tail content.",
          },
        ],
      },
    ],
  },
];
