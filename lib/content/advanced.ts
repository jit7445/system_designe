import type { Article } from "../types";

export const ADVANCED_ARTICLES: Article[] = [
  {
    slug: "consensus-and-leader-election",
    title: "Consensus and Leader Election",
    level: "advanced",
    summary: "How a group of unreliable machines agrees on one ordered history using Raft, Paxos and coordination services, and how leases and fencing tokens keep a deposed leader from doing damage.",
    tags: ["raft", "consensus", "zookeeper", "fencing"],
    sections: [
      {
        id: "why-consensus",
        heading: "Why consensus is needed",
        blocks: [
          { type: "p", text: "Replication protects data against a dead machine, but it creates a new problem: every replica must apply the **same writes in the same order**. If replica A applies `x = 1` then `x = 2` while replica B applies them the other way round, the system now holds two different truths. Consensus is the family of protocols that lets a group of nodes agree on a single value, or on a sequence of values, even when some nodes crash and the network delays or drops messages." },
          { type: "p", text: "The standard framing is the **replicated state machine**. Each node holds a deterministic state machine (a key-value store, a lock table, a config map) plus a log of commands. If every node applies the same log in the same order, every node ends in the same state. Consensus is the job of agreeing on that log." },
          { type: "p", text: "Consensus protocols rely on **majority quorums**. A cluster of `2f + 1` nodes tolerates `f` failures, because any two majorities overlap in at least one node, and that overlapping node carries knowledge of earlier decisions forward. This is why clusters have odd sizes: going from 3 to 4 nodes raises the quorum without raising the number of failures you can survive." },
          { type: "table", head: ["Cluster size", "Quorum", "Failures tolerated", "Notes"], rows: [
            ["3", "2", "1", "Typical minimum for production"],
            ["4", "3", "1", "Same tolerance as 3, slower writes"],
            ["5", "3", "2", "Common choice for etcd and ZooKeeper"],
            ["7", "4", "3", "Rarely worth it: every write waits on more acks"],
          ] },
          { type: "callout", tone: "tip", title: "Where you meet consensus", text: "You rarely implement consensus inside an application. You meet it inside etcd (Kubernetes state), ZooKeeper (Kafka metadata in older versions, HBase), Kafka KRaft, CockroachDB and TiDB ranges, and Consul. Knowing how it works tells you what these systems can and cannot promise." },
        ],
      },
      {
        id: "raft-leader-election",
        heading: "Raft: terms and leader election",
        blocks: [
          { type: "p", text: "Raft was designed to be understandable, and it gets there by splitting the problem into leader election, log replication and safety. Every node is a **follower**, a **candidate** or the **leader**. Time is divided into **terms**, numbered with a monotonically increasing integer. Each term starts with an election and has at most one leader. Terms act as a logical clock: any message carrying an older term is rejected, and any node that sees a newer term immediately steps down to follower." },
          { type: "list", items: [
            "The leader sends periodic heartbeats (empty `AppendEntries` calls) to all followers.",
            "A follower that hears nothing for its **election timeout** (randomized, for example 150 to 300 ms) assumes the leader is dead.",
            "It increments its term, becomes a candidate, votes for itself and sends `RequestVote` to everyone else.",
            "Each node grants at most **one vote per term**, and only to a candidate whose log is at least as up to date as its own (compare last log term first, then last log index).",
            "A candidate with votes from a majority becomes leader and starts heartbeating. If no one wins, the timeout fires again and a new term begins.",
          ], ordered: true },
          { type: "diagram", chart: `sequenceDiagram
  participant A as Node A
  participant B as Node B
  participant C as Node C
  Note over A,C: Leader of term 2 stops sending heartbeats
  A->>A: Election timeout, become candidate for term 3
  A->>B: RequestVote term 3, lastLogTerm 2, lastLogIndex 7
  A->>C: RequestVote term 3, lastLogTerm 2, lastLogIndex 7
  B-->>A: Vote granted for term 3
  C-->>A: Vote granted for term 3
  Note over A: Majority reached, A is leader for term 3
  A->>B: AppendEntries heartbeat term 3
  A->>C: AppendEntries heartbeat term 3`, caption: "A Raft election: the first node to time out asks for votes and wins with a majority." },
          { type: "p", text: "Randomized timeouts are the trick that keeps elections fast. If every follower timed out at the same instant, they would all vote for themselves and split the vote forever. With randomness, one node usually times out first and collects votes before the others wake up. The **up-to-date log check** is the safety rule: it guarantees that a new leader already holds every committed entry, so a leader never has to fetch missing history from followers." },
        ],
      },
      {
        id: "raft-log-replication",
        heading: "Raft: log replication and the commit index",
        blocks: [
          { type: "p", text: "Clients send writes only to the leader. The leader appends the command to its own log, tagged with the current term and the next index, then sends `AppendEntries` to followers. Each request includes `prevLogIndex` and `prevLogTerm`, the position and term of the entry just before the new ones. A follower accepts only if its own log has a matching entry at that position. If not, it rejects, and the leader walks backwards until it finds the point where the logs agree, then overwrites the follower's divergent tail. This **log matching property** means that if two logs agree at some index and term, they agree on everything before it." },
          { type: "p", text: "An entry is **committed** once the leader knows it is stored on a majority. The leader tracks the highest such index as its **commit index** and piggybacks it on later `AppendEntries` calls, so followers learn which entries are safe to apply to their state machines. Only committed entries are applied, and only then does the leader reply success to the client." },
          { type: "diagram", chart: `sequenceDiagram
  participant Cl as Client
  participant L as Leader
  participant F1 as Follower 1
  participant F2 as Follower 2
  Cl->>L: SET x 5
  L->>L: Append entry at index 8, term 3
  L->>F1: AppendEntries term 3, prev 7, entry 8
  L->>F2: AppendEntries term 3, prev 7, entry 8
  F1-->>L: Success, matchIndex 8
  Note over L: Leader plus F1 is a majority, commitIndex becomes 8
  L->>L: Apply entry 8 to state machine
  L-->>Cl: OK
  F2-->>L: Success, matchIndex 8
  L->>F1: Next heartbeat carries commitIndex 8`, caption: "Log replication: a write is acknowledged after a majority stores it, before the slowest follower answers." },
          { type: "callout", tone: "warning", title: "A subtle safety rule", text: "A new leader does not mark entries from earlier terms as committed just because they now sit on a majority. It commits an entry from its **own** term first, which implicitly commits everything before it. This is why new leaders often append a no-op entry right after winning an election." },
          { type: "p", text: "Reads need care too. A leader that has been partitioned away may still believe it is leader and serve stale data. Linearizable reads either go through the log, or use a **ReadIndex** round (confirm leadership with a heartbeat to a majority before answering), or rely on a leader lease that assumes bounded clock drift." },
        ],
      },
      {
        id: "paxos-and-coordination-services",
        heading: "Paxos, ZooKeeper and etcd",
        blocks: [
          { type: "p", text: "Paxos predates Raft and solves the same problem with a different shape. In **single-decree Paxos**, a proposer picks a ballot number and sends `Prepare(n)` to acceptors. Each acceptor promises to ignore lower ballots and reports any value it already accepted. If a majority promises, the proposer sends `Accept(n, v)`, where `v` must be the highest-ballot value reported back, or its own value if none was. Once a majority accepts, the value is chosen. **Multi-Paxos** runs this for each log slot and keeps a stable leader so the prepare phase can be skipped in the common case, which makes it look a lot like Raft in practice." },
          { type: "p", text: "Raft is essentially a strongly opinionated Multi-Paxos: one leader, logs that never have holes, and a clearly specified membership change procedure. That is why most new systems pick Raft, while Paxos variants live on in Google Chubby, Spanner and some older stores." },
          { type: "cards", items: [
            { title: "Leader election", text: "Each candidate creates an ephemeral sequential znode in ZooKeeper, or tries to put a key with a lease in etcd. The lowest sequence number, or whoever wins the put, is leader. When its session or lease dies, the next one takes over." },
            { title: "Distributed locks", text: "Same building blocks as election. Holders watch only their predecessor node to avoid a thundering herd when a lock is released." },
            { title: "Configuration and service metadata", text: "Small, critical, strongly consistent data: feature flags, partition assignments, cluster membership. Watches push changes to clients." },
            { title: "Not a database", text: "These stores keep everything in memory and replicate every write through consensus. They suit kilobytes to low gigabytes of hot metadata, not user data." },
          ] },
          { type: "tradeoff", question: "Embed a Raft library or depend on an external coordinator?", a: "Embed Raft (as Kafka KRaft and CockroachDB do): no external dependency and full control over the log, but you own a difficult piece of correctness-critical code.", b: "Use etcd or ZooKeeper: battle-tested and simple to call, but one more cluster to run, and its availability becomes your availability.", verdict: "Application services should use an existing coordinator. Embedding consensus only pays off when you are building the storage system itself." },
        ],
      },
      {
        id: "split-brain-and-fencing",
        heading: "Split brain, leases and fencing tokens",
        blocks: [
          { type: "p", text: "**Split brain** happens when two nodes both believe they are the leader and both accept writes. Majority quorums prevent it inside a correct consensus group, because a partitioned minority cannot elect anyone. The danger is outside the group: an application node that was told it holds a lock may pause (a long GC, a VM migration, a slow disk) past the lock expiry, wake up, and keep writing while a new holder is also writing." },
          { type: "p", text: "A **lease** is a lock with a time limit. The holder must renew it before it expires, so a crashed holder automatically loses it. But leases depend on time, and the paused process does not know time has passed. The fix is the **fencing token**: every time the lock service grants the lease it hands out a strictly increasing number, and the protected resource rejects any request carrying a token lower than the highest it has seen." },
          { type: "diagram", chart: `graph LR
  LS[["Lock Service"]] -->|"lease, token 33"| W1["Worker 1"]
  LS -->|"lease, token 34"| W2["Worker 2"]
  W1 -->|"write with token 33, after GC pause"| ST[("Storage")]
  W2 -->|"write with token 34"| ST
  ST -->|"reject 33, already saw 34"| W1`, caption: "The storage layer, not the client, enforces fencing, so a stale leader cannot corrupt data." },
          { type: "code", lang: "ts", code: `function applyWrite(req: { token: number; key: string; value: string }) {
  const highest = store.getHighestToken(req.key);
  if (req.token < highest) {
    throw new Error("stale fencing token");
  }
  // check and write must be atomic, or two writers can race between them
  store.writeAtomically(req.key, req.value, req.token);
}`, caption: "Fencing check on the resource side. In etcd the revision of the lock key works as the token; in ZooKeeper the zxid or znode version does." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Say **majority quorum** and explain why clusters are odd-sized. Describe Raft in three beats: terms with randomized election timeouts, replication with `prevLogIndex` consistency checks, and commit once a majority stores the entry. Then show you know the failure mode that bites real systems: a lease alone does not stop a paused ex-leader, so the resource must check a **fencing token**. Bonus points for noting that a 5-node etcd cluster is the usual answer for coordination, not a hand-rolled protocol." },
        ],
      },
    ],
  },
  {
    slug: "distributed-transactions",
    title: "Distributed Transactions",
    level: "advanced",
    summary: "Why ACID stops at the service boundary, what two-phase commit costs, and how sagas, the transactional outbox and idempotent consumers give you correctness without a global lock.",
    tags: ["2pc", "saga", "outbox", "idempotency"],
    sections: [
      {
        id: "why-cross-service-acid-is-hard",
        heading: "Why cross-service ACID is hard",
        blocks: [
          { type: "p", text: "Inside one relational database, a transaction that debits one account and credits another is trivial: the database holds locks, writes a single log record, and either both changes become visible or neither does. Split those accounts across two services with two databases and the guarantee disappears. Each database can commit or abort on its own, the network between them can fail at any moment, and neither side can see the other's locks." },
          { type: "p", text: "Consider an order flow: the Order service creates an order, the Payment service charges a card, and the Inventory service reserves stock. Any step can fail after earlier steps succeeded. A crash between charging the card and reserving stock leaves a customer charged for an item that will never ship. The question in every interview is how you prevent or repair that half-finished state." },
          { type: "list", items: [
            "**Atomicity** needs every participant to agree on commit or abort, which is a consensus problem.",
            "**Isolation** needs locks or versions that span databases, and long-held cross-service locks destroy throughput.",
            "**Availability** suffers because the transaction can only finish when every participant is reachable.",
            "**Heterogeneity**: one service uses Postgres, another DynamoDB, another a third-party payment API that has no notion of a prepare phase.",
          ] },
        ],
      },
      {
        id: "two-phase-commit",
        heading: "Two-phase commit and its blocking problem",
        blocks: [
          { type: "p", text: "**Two-phase commit (2PC)** is the classic protocol for atomic commit across participants. A coordinator first asks every participant to **prepare**: each one writes the changes durably, takes the needed locks, and votes yes or no. If all vote yes, the coordinator writes its commit decision to its own log and tells everyone to **commit**. If anyone votes no or times out, it tells everyone to abort." },
          { type: "diagram", chart: `sequenceDiagram
  participant C as Coordinator
  participant P1 as Orders DB
  participant P2 as Payments DB
  C->>P1: Prepare txn 42
  C->>P2: Prepare txn 42
  P1-->>C: Vote yes, locks held
  P2-->>C: Vote yes, locks held
  C->>C: Write commit decision to log
  alt Coordinator alive
    C->>P1: Commit txn 42
    C->>P2: Commit txn 42
  else Coordinator crashes here
    Note over P1,P2: Both stay prepared, locks held, cannot decide alone
  end`, caption: "2PC is safe but blocking: a prepared participant must wait for the coordinator's decision." },
          { type: "p", text: "The weakness is the window after a participant votes yes. It has promised to commit if told to, so it cannot abort on its own, but it also cannot commit without knowing the others voted yes. If the coordinator crashes in that window, participants sit **in doubt** holding locks until it recovers. Every other transaction touching those rows waits too. Three-phase commit tries to fix this but assumes bounded network delay, which real networks do not provide, so it is rarely used. Production systems that need atomic commit (Spanner, CockroachDB) make the coordinator itself fault tolerant by replicating its decision with Paxos or Raft." },
          { type: "tradeoff", question: "Use 2PC (XA) across microservices?", a: "2PC: true atomicity and isolation, but synchronous, lock-holding, coupled to every participant's availability, and unsupported by most queues and SaaS APIs.", b: "Sagas: each step commits locally and failures are undone by compensations, so services stay independent, at the cost of intermediate states being visible.", verdict: "Use 2PC only inside one storage system that implements it well (a distributed SQL database). Across services owned by different teams, use sagas." },
        ],
      },
      {
        id: "sagas",
        heading: "Sagas: choreography vs orchestration",
        blocks: [
          { type: "p", text: "A **saga** is a sequence of local transactions, each in one service, where every step has a **compensating action** that semantically undoes it. If step 3 fails, the saga runs the compensations for steps 2 and 1 in reverse order. Compensations are business operations, not database rollbacks: you cannot unsend an email, but you can send an apology; you cannot un-charge a card, but you can issue a refund." },
          { type: "p", text: "In **choreography**, there is no central brain. Each service listens for events and reacts: Orders emits `OrderCreated`, Payments hears it, charges and emits `PaymentCompleted`, Inventory hears that and reserves stock. In **orchestration**, a dedicated orchestrator (often built on a workflow engine like Temporal, AWS Step Functions or Camunda) sends commands to each service and decides what happens next." },
          { type: "diagram", chart: `sequenceDiagram
  participant O as Order Orchestrator
  participant P as Payment Service
  participant I as Inventory Service
  O->>P: Charge card for order 17
  P-->>O: Charged, payment id 9
  O->>I: Reserve 2 units of SKU 55
  I-->>O: Failed, out of stock
  Note over O: Start compensation in reverse order
  O->>P: Refund payment 9
  P-->>O: Refunded
  O->>O: Mark order 17 as cancelled`, caption: "An orchestrated saga: the orchestrator persists its state after each step so it can resume after a crash." },
          { type: "table", head: ["Aspect", "Choreography", "Orchestration"], rows: [
            ["Control flow", "Implicit, spread across event handlers", "Explicit, in one workflow definition"],
            ["Coupling", "Services know about each other's events", "Services know only their own commands"],
            ["Visibility", "Hard to answer where is order 17 now", "Workflow state is queryable"],
            ["Best for", "Short flows of 2 to 4 steps", "Long or branching flows with timeouts and retries"],
            ["Risk", "Cyclic event dependencies, hidden logic", "Orchestrator becomes a bottleneck or god service"],
          ] },
          { type: "callout", tone: "warning", title: "Sagas are not isolated", text: "Other requests can see a saga's intermediate state, for example an order that is charged but not yet reserved. Countermeasures include **semantic locks** (a `PENDING` status that other flows respect), ordering steps so the riskiest or least compensable one runs last, and making compensations commutative so they can retry safely." },
        ],
      },
      {
        id: "transactional-outbox",
        heading: "The transactional outbox pattern",
        blocks: [
          { type: "p", text: "Every saga step has the same hidden bug if written naively: it updates its database and then publishes an event to Kafka. Those are two separate systems, so this is a **dual write**. If the process crashes after the commit but before the publish, the event is lost and the saga stalls. If you publish first and the commit fails, downstream services act on something that never happened." },
          { type: "p", text: "The **transactional outbox** removes the dual write. The service writes the business row and an event row into an `outbox` table **in the same local transaction**. A separate relay process reads the outbox and publishes to the broker, marking rows as sent or deleting them. Either both the state change and the event exist, or neither does. The relay can poll the table or, better, tail the database log using change data capture." },
          { type: "diagram", chart: `graph LR
  API["Order Service"] -->|"one local transaction"| DB[("Orders and Outbox tables")]
  DB -->|"poll or tail WAL"| RELAY["Outbox Relay"]
  RELAY -->|"publish"| K[["Kafka topic"]]
  K --> PAY["Payment Service"]
  K --> MAIL["Email Service"]`, caption: "The outbox turns a dual write into a single atomic write plus an asynchronous, retryable publish." },
          { type: "code", lang: "sql", code: `BEGIN;
INSERT INTO orders (id, user_id, status, total_cents)
VALUES ('ord_17', 'u_4', 'PENDING', 4999);

INSERT INTO outbox (id, aggregate_id, event_type, payload, created_at)
VALUES ('evt_901', 'ord_17', 'OrderCreated',
        '{"orderId":"ord_17","totalCents":4999}', now());
COMMIT;`, caption: "Both rows commit or neither does. The relay publishes evt_901 later, possibly more than once." },
          { type: "p", text: "Notice the last line of that caption. The relay may crash after publishing but before marking the row sent, so it will publish again on restart. The outbox gives you **at-least-once** delivery, never exactly-once. That pushes the final piece of correctness onto the consumer." },
        ],
      },
      {
        id: "idempotent-consumers",
        heading: "Idempotent consumers",
        blocks: [
          { type: "p", text: "An operation is **idempotent** if doing it twice has the same effect as doing it once. Setting `status = SHIPPED` is naturally idempotent; incrementing a balance is not. Since brokers, relays and retries all deliver duplicates, every consumer that causes side effects must tolerate them." },
          { type: "list", items: [
            "**Dedup table**: record each processed event id in a `processed_events` table inside the same transaction as the side effect. A unique constraint makes the second attempt fail harmlessly.",
            "**Idempotency keys on APIs**: clients send a key such as `Idempotency-Key: 7f3a...` with a payment request; the server stores the key with the result and returns the stored result on a retry. Stripe popularized this.",
            "**Version or sequence checks**: apply an update only if the event's version is newer than the stored one, which also handles out-of-order delivery.",
            "**Natural idempotency**: model writes as absolute assignments or upserts instead of deltas where possible.",
          ] },
          { type: "code", lang: "sql", code: `BEGIN;
INSERT INTO processed_events (event_id) VALUES ('evt_901');
-- a duplicate violates the primary key here and the whole transaction rolls back
UPDATE wallets SET balance_cents = balance_cents - 4999 WHERE user_id = 'u_4';
COMMIT;`, caption: "Dedup and side effect share one transaction, so a crash between them is impossible." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Name the dual-write problem before anyone else does, and solve it with an **outbox**. Explain why 2PC blocks when the coordinator dies after prepare, then choose a **saga** and spell out the compensations for each step. Close with the honest delivery guarantee: at-least-once plus **idempotent consumers** equals effectively-once processing. Strong candidates also mention that sagas lack isolation and say how they would handle a user seeing a pending order." },
        ],
      },
    ],
  },
  {
    slug: "event-driven-architecture",
    title: "Event-Driven Architecture",
    level: "advanced",
    summary: "Designing systems around facts that already happened, using event sourcing, CQRS and change data capture, while managing eventual consistency, replays and schema evolution.",
    tags: ["events", "cqrs", "cdc", "kafka"],
    sections: [
      {
        id: "events-vs-commands",
        heading: "Events vs commands",
        blocks: [
          { type: "p", text: "Messages in an asynchronous system come in two flavours, and mixing them up leads to tangled designs. A **command** is a request for something to happen: `ReserveInventory`. It has one intended handler, it can be rejected, and the sender usually cares about the outcome. An **event** is a fact about the past: `InventoryReserved`. It cannot be rejected because it already happened, it is named in the past tense, and the publisher does not know or care how many consumers react to it." },
          { type: "table", head: ["", "Command", "Event"], rows: [
            ["Meaning", "Please do X", "X happened"],
            ["Naming", "Imperative: `ChargeCard`", "Past tense: `CardCharged`"],
            ["Receivers", "Exactly one handler", "Zero or many subscribers"],
            ["Can fail?", "Yes, the handler may refuse", "No, it is a recorded fact"],
            ["Coupling", "Sender knows the receiver", "Publisher is unaware of consumers"],
            ["Typical transport", "Queue (SQS, RabbitMQ) or RPC", "Log or topic (Kafka, Pulsar, SNS)"],
          ] },
          { type: "p", text: "The main benefit of events is **temporal and organizational decoupling**. The Order service publishes `OrderPlaced` once; the email, analytics, fraud and loyalty teams subscribe without asking the Order team to change anything. The cost is that the overall workflow is no longer written in one place, and you need tracing and good event catalogs to understand it." },
          { type: "callout", tone: "tip", title: "Thin vs fat events", text: "A thin event carries ids only (`OrderPlaced {orderId}`), forcing consumers to call back for details and creating load and coupling. A fat event carries the relevant state, so consumers are self-sufficient. Prefer fat events for integration, but include only fields you are willing to support as a contract." },
        ],
      },
      {
        id: "event-sourcing",
        heading: "Event sourcing",
        blocks: [
          { type: "p", text: "In a normal design the database holds current state and history is lost on every update. **Event sourcing** flips this: the source of truth is an append-only log of domain events per entity (an **aggregate**), and current state is derived by replaying them. A bank account is not a row with `balance = 70`; it is `Opened`, `Deposited 100`, `Withdrew 30`." },
          { type: "code", lang: "ts", code: `type AccountEvent =
  | { type: "Opened"; accountId: string }
  | { type: "Deposited"; amountCents: number }
  | { type: "Withdrew"; amountCents: number };

function rebuild(events: AccountEvent[]) {
  return events.reduce(
    (state, e) => {
      switch (e.type) {
        case "Opened": return { ...state, open: true };
        case "Deposited": return { ...state, balance: state.balance + e.amountCents };
        case "Withdrew": return { ...state, balance: state.balance - e.amountCents };
      }
    },
    { open: false, balance: 0 }
  );
}`, caption: "State is a left fold over the event stream. Snapshots every N events keep rebuilds fast." },
          { type: "p", text: "Writes use **optimistic concurrency**: a command loads the aggregate at version 41, validates business rules, and appends new events only if the stream is still at version 41. A concurrent writer causes a conflict and a retry, not a lost update. Long streams are kept fast with **snapshots**: persist the folded state every few hundred events and replay only what came after." },
          { type: "tradeoff", question: "Event sourcing or a conventional state table?", a: "Event sourcing: perfect audit trail, time travel to any past state, new read models can be built from history, natural fit for publishing events.", b: "State table: simple queries, familiar tooling, easy to fix bad data with an UPDATE, and no need to version every historical event forever.", verdict: "Use event sourcing for domains where history is the product (ledgers, orders, compliance-heavy workflows). Use plain tables plus an outbox everywhere else. It is a per-aggregate choice, not a whole-company one." },
        ],
      },
      {
        id: "cqrs",
        heading: "CQRS and eventually consistent read models",
        blocks: [
          { type: "p", text: "**Command Query Responsibility Segregation** separates the model that handles writes from the models that serve reads. The write side enforces invariants on normalized data or an event store. Projectors consume the resulting events and build **read models** shaped for specific queries: a denormalized order summary in Postgres, a search index in Elasticsearch, a per-user feed in Redis." },
          { type: "diagram", chart: `graph LR
  U(["Client"]) -->|"commands"| W["Write API"]
  W --> ES[("Event Store")]
  ES --> BUS[["Event Stream"]]
  BUS --> P1["Order Summary Projector"]
  BUS --> P2["Search Projector"]
  P1 --> RM1[("Read DB")]
  P2 --> RM2{{"Search Index"}}
  U -->|"queries"| R["Query API"]
  R --> RM1
  R --> RM2`, caption: "CQRS: each read model is a disposable projection that can be rebuilt from the stream." },
          { type: "p", text: "The price is **eventual consistency** between the two sides. A user who places an order and immediately opens the order list may not see it, because the projector is a few hundred milliseconds behind. Interviewers love to probe this. Common answers:" },
          { type: "list", items: [
            "**Read your own writes**: the command returns the new version; the client passes it on the next query and the query API waits briefly or falls back to the write store until the projection reaches that version.",
            "**Optimistic UI**: the client shows the new item immediately from its own state.",
            "**Route the author to the write model** for a short window after a write, while everyone else reads the projection.",
            "**Expose lag**: monitor consumer lag per projector and alert when it grows, because a silent stuck projector looks like data loss to users.",
          ] },
        ],
      },
      {
        id: "change-data-capture",
        heading: "Change data capture",
        blocks: [
          { type: "p", text: "Many systems are not event-sourced but still need to publish changes. **Change data capture (CDC)** reads the database's own replication log (the Postgres WAL through logical decoding, the MySQL binlog, MongoDB change streams) and turns every committed insert, update and delete into an event. Tools such as Debezium run as Kafka Connect source connectors, track their log position, and emit one message per row change to a topic per table." },
          { type: "diagram", chart: `graph LR
  APP["Legacy App"] --> PG[("Postgres")]
  PG -->|"WAL logical decoding"| DBZ["CDC Connector"]
  DBZ --> K[["Kafka topics per table"]]
  K --> SEARCH{{"Search Index"}}
  K --> WH[("Data Warehouse")]
  K --> CACHE["Cache Invalidator"]`, caption: "CDC captures changes after commit, so no write can be missed and the app needs no code changes." },
          { type: "p", text: "Because CDC reads committed log records, it has none of the dual-write problems of application-level publishing and preserves per-row commit order. It is the standard way to keep search indexes, caches and warehouses in sync, and to strangle a monolith by streaming its data into new services." },
          { type: "tradeoff", question: "Publish raw table changes via CDC or domain events via an outbox?", a: "Raw CDC: zero application changes and complete coverage, but consumers couple to your internal schema, and a column rename breaks them.", b: "Outbox events: a deliberate public contract designed for consumers, but requires code in every write path.", verdict: "Use raw CDC for internal plumbing you own (search, cache, analytics). For events other teams consume, use an outbox table and let CDC ship the outbox rows. That combination is exactly what Debezium's outbox router supports." },
        ],
      },
      {
        id: "replay-and-schema-evolution",
        heading: "Replay and schema evolution",
        blocks: [
          { type: "p", text: "A retained event log is a superpower: you can build a brand new read model by **replaying** history from offset zero, fix a buggy projection by deleting it and replaying, or reproduce a production bug locally. Replay only works if projectors are **idempotent** (upsert by key, track the last applied offset in the same store) and if side effects such as emails are separated from state projections, otherwise a replay re-sends a year of emails." },
          { type: "p", text: "Events live for years, so their schemas must evolve without breaking old data or old consumers. Use a schema format with explicit evolution rules (Avro, Protobuf or JSON Schema) and a **schema registry** that rejects incompatible changes at publish time." },
          { type: "table", head: ["Compatibility mode", "Guarantee", "Allowed changes"], rows: [
            ["Backward", "New consumers read old events", "Add optional fields with defaults, remove fields"],
            ["Forward", "Old consumers read new events", "Add fields, remove optional fields"],
            ["Full", "Both directions", "Add or remove optional fields with defaults only"],
            ["Breaking", "Neither", "Rename or retype a field: publish a new event type or version instead"],
          ] },
          { type: "p", text: "For event-sourced stores, **upcasting** converts old event versions into the current shape when they are read, so domain code only handles the latest version. Never rewrite history in place unless a legal requirement forces it, and for personal data consider **crypto-shredding**: encrypt per-user fields with a per-user key and delete the key to honor erasure requests." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Distinguish commands from events cleanly. Present CQRS as a tool for read-heavy or multi-shape query needs, not a default, and immediately address the **read-your-writes** gap it creates. Know that CDC reads the database log (WAL or binlog) and why that avoids dual writes. Finally, show you have lived with events in production: idempotent projectors for replay, consumer lag monitoring, and a schema registry with compatibility rules." },
        ],
      },
    ],
  },
  {
    slug: "microservices-patterns",
    title: "Microservices Patterns",
    level: "advanced",
    summary: "When splitting a monolith pays off and the patterns that keep a fleet of services healthy: discovery, gateways, circuit breakers, retries with jitter, timeouts, bulkheads and inter-service rate limits.",
    tags: ["microservices", "resilience", "gateway"],
    sections: [
      {
        id: "when-to-split",
        heading: "When to split a monolith",
        blocks: [
          { type: "p", text: "Microservices are an organizational scaling tool first and a technical one second. They let many teams deploy independently, choose fitting storage, and scale hot components separately. They also turn every function call into a network call that can be slow, fail or arrive twice, and they replace one database transaction with a distributed one. A senior answer acknowledges both sides." },
          { type: "cards", items: [
            { title: "Good reasons to split", text: "Teams block each other on releases; one component has very different scaling or availability needs; a domain has clear boundaries and its own data; compliance requires isolating a component such as payments." },
            { title: "Bad reasons to split", text: "It sounds modern; the codebase is messy (a distributed mess is worse); a team of five wants twenty services; you have not yet found the domain boundaries." },
            { title: "Modular monolith", text: "One deployable with strictly enforced internal modules and no shared tables across modules. Often the right step before extracting services, because boundaries can be fixed cheaply." },
            { title: "Strangler fig", text: "Put a proxy in front of the monolith and route one capability at a time to a new service, using CDC to sync data until the old path can be deleted." },
          ] },
          { type: "tradeoff", question: "Start a new product as microservices?", a: "Microservices from day one: clean ownership later, but you guess domain boundaries before understanding the domain, and pay the operational tax with no team-scaling benefit yet.", b: "Modular monolith first: fast iteration and simple transactions, with extraction once boundaries and team structure stabilize.", verdict: "Modular monolith first, unless the organization already has many teams or a component has clearly distinct scaling needs. Split along business capabilities with each service owning its data." },
        ],
      },
      {
        id: "service-discovery",
        heading: "Service discovery",
        blocks: [
          { type: "p", text: "Instances of a service come and go with autoscaling and deploys, so callers cannot hard-code addresses. A **service registry** (Consul, etcd, Eureka, or the Kubernetes API) holds the live list of healthy instances. Instances register on startup and are removed when health checks fail or their lease expires." },
          { type: "list", items: [
            "**Client-side discovery**: the caller queries the registry, caches the instance list and load balances itself. Fewer hops, but every language needs a smart client library.",
            "**Server-side discovery**: the caller hits a stable virtual address (a load balancer or a Kubernetes `Service`), which picks an instance. Simple clients, one extra hop.",
            "**Service mesh**: a sidecar proxy such as Envoy next to every instance does discovery, load balancing, mTLS, retries and metrics, configured centrally by a control plane like Istio or Linkerd. Clients stay simple and get uniform behaviour.",
          ] },
          { type: "diagram", chart: `graph LR
  A["Checkout Service"] --> SA{{"Sidecar Proxy"}}
  SA -->|"mTLS"| SB1{{"Sidecar Proxy"}}
  SA -->|"mTLS"| SB2{{"Sidecar Proxy"}}
  SB1 --> B1["Payment instance 1"]
  SB2 --> B2["Payment instance 2"]
  CP[["Mesh Control Plane"]] -->|"endpoints and policy"| SA
  REG[("Service Registry")] --> CP`, caption: "In a mesh, the sidecar resolves and balances calls using endpoints pushed by the control plane." },
        ],
      },
      {
        id: "gateway-and-bff",
        heading: "API gateway and backend for frontend",
        blocks: [
          { type: "p", text: "External clients should not know about fifty internal services. An **API gateway** is the single entry point that handles cross-cutting concerns: TLS termination, authentication, rate limiting, request routing, and sometimes response aggregation. A **backend for frontend (BFF)** is a gateway layer dedicated to one client type, owned by that client's team, that shapes responses for its screens: the mobile BFF returns compact payloads, the web BFF returns richer ones." },
          { type: "table", head: ["Concern", "API gateway", "BFF"], rows: [
            ["Scope", "All clients", "One client type"],
            ["Owner", "Platform team", "Frontend or product team"],
            ["Typical logic", "Auth, rate limits, routing, TLS", "Aggregation, field selection, client-specific formats"],
            ["Business rules", "None", "Presentation only, never core rules"],
            ["Risk", "Single point of failure, config sprawl", "Duplicated logic across BFFs"],
          ] },
          { type: "callout", tone: "warning", title: "Keep the gateway dumb", text: "Once business logic creeps into the gateway, every team needs to change it and it becomes the new monolith. Keep domain rules in services and keep the gateway to routing and policy." },
        ],
      },
      {
        id: "circuit-breakers-and-timeouts",
        heading: "Timeouts and circuit breakers",
        blocks: [
          { type: "p", text: "The most common way a microservice system dies is not a crash but a **slow dependency**. If the Recommendations service starts taking 30 seconds, every caller thread waiting on it is stuck, the caller's pool fills up, and the caller now looks dead to its own callers. This is a **cascading failure**. The first defence is a **timeout on every network call**, set from the dependency's observed latency (for example a bit above its p99.9) rather than a library default, which is often infinite or 30 seconds." },
          { type: "p", text: "Better still, propagate a **deadline**: the edge sets an overall budget (say 800 ms) and passes the remaining time downstream in a header, so a service deep in the call graph does not start work that its caller has already given up on. gRPC supports this natively." },
          { type: "p", text: "A **circuit breaker** wraps calls to a dependency and tracks failures. When the failure rate over a window crosses a threshold, it **opens** and fails calls instantly without touching the network, giving the dependency room to recover and freeing the caller's resources. After a cool-down it goes **half-open** and lets a few trial requests through. Success closes it; failure opens it again." },
          { type: "diagram", chart: `graph LR
  CL["Closed: calls pass"] -->|"failure rate above threshold"| OP["Open: fail fast"]
  OP -->|"cool-down elapsed"| HO["Half-open: trial calls"]
  HO -->|"trials succeed"| CL
  HO -->|"a trial fails"| OP`, caption: "Circuit breaker states. While open, the caller serves a fallback such as cached or default data." },
        ],
      },
      {
        id: "retries-with-backoff",
        heading: "Retries with exponential backoff and jitter",
        blocks: [
          { type: "p", text: "Retries fix transient failures, but naive retries cause outages. If a service is overloaded and every client retries immediately, load doubles exactly when capacity is lowest. Three rules make retries safe: **back off exponentially**, **add jitter** so clients do not retry in synchronized waves, and **cap the total** with a retry budget (for example retries may add at most 10 percent extra load). Retry only idempotent operations, or non-idempotent ones that carry an idempotency key, and only on retryable errors such as timeouts, 503 and 429, never on 400." },
          { type: "code", lang: "ts", code: `async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  const baseMs = 100;
  const capMs = 5000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      // full jitter: pick uniformly between 0 and the exponential ceiling
      const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
      const delay = Math.random() * ceiling;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}`, caption: "Exponential backoff with full jitter. Honor a Retry-After header when the server sends one." },
          { type: "p", text: "Retry at **one layer** only. If the browser, the gateway, the BFF and the service each retry three times, a single failing call at the bottom becomes 81 attempts. Typically the layer closest to the failure retries, and the others pass errors up." },
        ],
      },
      {
        id: "bulkheads-and-rate-limiting",
        heading: "Bulkheads and rate limiting between services",
        blocks: [
          { type: "p", text: "A ship's bulkheads stop one flooded compartment from sinking the vessel. In software, a **bulkhead** gives each dependency its own bounded pool of threads, connections or concurrency slots. If calls to the slow Recommendations service exhaust their pool of 20, calls to Payments still have their own pool and keep working. The same idea applies at larger scale with per-tenant queues, separate clusters for critical and batch traffic, and **cell-based architecture** where each cell serves a slice of customers." },
          { type: "p", text: "Services also need protection from each other. A buggy batch job in one team can flood a shared service. Per-caller **rate limits and quotas** at the service (or in the mesh) keyed by calling service identity keep one consumer from starving the rest. Prefer **concurrency limits** for protecting the service itself, because they adapt to latency automatically, and request-rate quotas for fairness between callers." },
          { type: "tradeoff", question: "Where should resilience logic live?", a: "In libraries inside each service (resilience4j, Polly): fine-grained and context-aware, but every language and team must implement it consistently.", b: "In a service mesh sidecar: uniform timeouts, retries and breakers configured centrally, but less aware of business semantics such as which calls are idempotent.", verdict: "Use the mesh for baseline timeouts, mTLS and outlier ejection, and keep business-aware decisions (fallback content, idempotency keys) in application code." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Justify the split with team and scaling reasons, not fashion, and mention a modular monolith as a valid starting point. When you draw a synchronous call between services, say what its **timeout** is, whether it is **retried with backoff and jitter**, and what the **fallback** is when the **circuit breaker** opens. Mention bulkheads to contain a slow dependency and avoiding retry amplification across layers. That combination is what separates a box-drawer from someone who has been paged." },
        ],
      },
    ],
  },
  {
    slug: "reliability-and-observability",
    title: "Reliability and Observability",
    level: "advanced",
    summary: "Defining reliability with SLIs, SLOs and error budgets, seeing inside a system with metrics, logs and traces, and keeping it useful under stress through alerting, degradation, load shedding and chaos testing.",
    tags: ["slo", "observability", "sre"],
    sections: [
      {
        id: "sli-slo-sla",
        heading: "SLIs, SLOs, SLAs and error budgets",
        blocks: [
          { type: "p", text: "Reliability discussions go nowhere without numbers. A **service level indicator (SLI)** is a measured ratio of good events to total events, ideally from the user's point of view: the fraction of checkout requests that succeed in under 500 ms. A **service level objective (SLO)** is the target for that SLI over a window: 99.9 percent over 30 days. A **service level agreement (SLA)** is a contract with customers that carries a penalty, such as service credits, and is set looser than the SLO so you notice trouble before you owe money." },
          { type: "table", head: ["SLO", "Allowed bad time per 30 days", "Allowed bad time per year"], rows: [
            ["99%", "7.2 hours", "3.65 days"],
            ["99.9%", "43.2 minutes", "8.76 hours"],
            ["99.95%", "21.6 minutes", "4.38 hours"],
            ["99.99%", "4.32 minutes", "52.6 minutes"],
          ] },
          { type: "p", text: "The gap between 100 percent and the SLO is the **error budget**. At 99.9 percent over a million requests a month, you may fail 1,000. The budget turns reliability into a shared engineering decision: while budget remains, teams ship features and take risks; when it is spent, releases slow down and effort shifts to reliability. It also reminds everyone that 100 percent is the wrong target, because each extra nine costs far more than the last and users cannot tell the difference beyond the reliability of their own network." },
          { type: "callout", tone: "tip", title: "Availability compounds", text: "A request that depends serially on five services that each meet 99.9 percent has a best case of roughly 99.5 percent. Critical paths need fewer hard dependencies, or dependencies with higher targets than the service itself." },
        ],
      },
      {
        id: "three-pillars",
        heading: "The three pillars: metrics, logs and traces",
        blocks: [
          { type: "cards", items: [
            { title: "Metrics", text: "Numeric time series aggregated at the source: counters, gauges, histograms. Cheap to store and query, ideal for dashboards and alerts. Watch out for high-cardinality labels such as user ids, which explode storage." },
            { title: "Logs", text: "Timestamped records of discrete events. Use structured JSON with consistent fields (service, trace id, user id) so they can be filtered. Rich detail, but expensive at volume, so sample debug logs and set retention." },
            { title: "Traces", text: "The path of one request across services, as a tree of spans with timings. They answer which hop made this request slow. Usually sampled, with tail-based sampling keeping all errors and slow requests." },
          ] },
          { type: "p", text: "The pillars are most useful when linked. A latency alert (metric) leads to exemplar traces for slow requests, and each span links to the logs emitted with the same **trace id**. This only works if context propagates: every service forwards the W3C `traceparent` header and attaches the trace id to its logs. **OpenTelemetry** has become the standard instrumentation layer, exporting to backends such as Prometheus, Grafana Tempo, Jaeger or commercial vendors." },
          { type: "diagram", chart: `graph LR
  U(["User request"]) --> GW["Gateway span"]
  GW -->|"traceparent header"| OS["Order Service span"]
  OS -->|"traceparent header"| PS["Payment Service span"]
  OS --> DB[("DB query span")]
  GW --> COL[["OTel Collector"]]
  OS --> COL
  PS --> COL
  COL --> TB[("Trace Backend")]`, caption: "Each hop creates a child span and forwards the trace context; a collector batches and exports spans." },
        ],
      },
      {
        id: "red-and-use",
        heading: "RED and USE methods",
        blocks: [
          { type: "p", text: "Knowing what to measure is half the battle. Two short checklists cover most needs. **RED** applies to request-driven services and describes what users experience. **USE** applies to resources such as CPU, disks, connection pools and queues and helps find the bottleneck behind a RED symptom." },
          { type: "table", head: ["Method", "Signal", "Example for a checkout service"], rows: [
            ["RED", "Rate", "Requests per second by endpoint"],
            ["RED", "Errors", "Fraction of 5xx and timed-out requests"],
            ["RED", "Duration", "p50, p95, p99 latency from a histogram"],
            ["USE", "Utilization", "CPU at 85 percent, DB pool 18 of 20 connections busy"],
            ["USE", "Saturation", "Requests waiting for a pool connection, run queue length"],
            ["USE", "Errors", "Connection resets, disk IO errors"],
          ] },
          { type: "p", text: "Always track latency as **percentiles from histograms**, never averages. An average of 120 ms can hide a p99 of 4 seconds, and with fan-out the slowest backend call dictates the user's experience. Google's four golden signals (latency, traffic, errors, saturation) are essentially RED plus the saturation part of USE." },
        ],
      },
      {
        id: "alerting-on-symptoms",
        heading: "Alerting on symptoms",
        blocks: [
          { type: "p", text: "Pages should fire when **users are hurting**, not when a machine looks unusual. High CPU with healthy latency is not an emergency; rising checkout errors are, even if every host looks fine. Alert on symptoms (SLO burn), and use cause-based metrics on dashboards for diagnosis. Every page should be actionable, urgent and accompanied by a runbook link." },
          { type: "p", text: "The modern approach is **burn-rate alerting**. Burn rate is how fast you are spending the error budget relative to plan: a burn rate of 1 uses exactly the budget over the window; a burn rate of 14.4 sustained for one hour consumes 2 percent of a 30-day budget. Pair a fast window with a slow one (for example 1 hour and 5 minutes both above 14.4) so alerts fire quickly on real incidents but reset quickly once fixed, and add a lower-threshold ticket alert over several days for slow leaks." },
          { type: "tradeoff", question: "Threshold alerts on causes or burn-rate alerts on SLOs?", a: "Cause thresholds (CPU above 90 percent, queue above 1,000): easy to write and catch some issues early, but noisy, and they miss failure modes nobody predicted.", b: "SLO burn-rate alerts: few, meaningful pages tied directly to user pain, but require well-defined SLIs and can be slightly slower for gradual problems.", verdict: "Page on SLO burn rate. Keep cause-based thresholds as non-paging warnings and dashboard panels, except for hard limits such as a disk about to fill." },
        ],
      },
      {
        id: "degradation-and-chaos",
        heading: "Graceful degradation, load shedding and chaos testing",
        blocks: [
          { type: "p", text: "Systems will be overloaded or partially broken, so design how they behave when it happens. **Graceful degradation** means keeping the core function alive while dropping extras: an e-commerce page that cannot reach recommendations still shows the product and the buy button; a feed that cannot rank serves a cached or chronological version. Decide in advance which features are critical and put non-critical ones behind feature flags and circuit-breaker fallbacks." },
          { type: "p", text: "**Load shedding** rejects some work early so the rest succeeds, instead of letting every request slow down until all of them time out. Effective techniques:" },
          { type: "list", items: [
            "Reject at the edge with `503` or `429` once concurrency or queue depth passes a limit, before expensive work starts.",
            "**Prioritize**: shed analytics and prefetch traffic before user-facing writes; shed anonymous traffic before logged-in purchases.",
            "Drop requests that have waited longer than the client's deadline, since the answer would arrive too late anyway.",
            "Use adaptive concurrency limits that shrink as latency rises, similar to TCP congestion control.",
            "Bound every queue. An unbounded queue just converts overload into latency and memory exhaustion.",
          ] },
          { type: "p", text: "**Chaos testing** verifies these mechanisms before a real incident does. Start with a hypothesis (if one Payment instance dies, checkout success stays above 99.9 percent), inject a controlled fault (kill instances, add latency, drop a dependency, fail a zone), observe, and fix what breaks. Begin in staging with a small blast radius and a kill switch, then graduate to production game days. Netflix's Chaos Monkey popularized the idea; tools such as Gremlin, Chaos Mesh and AWS Fault Injection Service make it routine." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Turn vague requirements into an SLI and SLO with an error budget, and do the quick math (99.9 percent is about 43 minutes a month). Name metrics, logs and traces and how a **trace id** ties them together. Use RED for services and USE for resources. Say you would page on **SLO burn rate**, not CPU. Then describe how the system degrades under overload: which features are dropped first, where load is shed, and how you would prove it works with a chaos experiment." },
        ],
      },
    ],
  },
  {
    slug: "multi-region-and-disaster-recovery",
    title: "Multi-Region and Disaster Recovery",
    level: "advanced",
    summary: "How to run a system across regions, choosing between active-passive and active-active, setting RPO and RTO, resolving replication conflicts, failing over traffic, respecting data residency and keeping backups you can actually restore.",
    tags: ["multi-region", "disaster-recovery", "replication"],
    sections: [
      {
        id: "topologies",
        heading: "Active-passive vs active-active",
        blocks: [
          { type: "p", text: "Multiple availability zones in one region protect against a data center failure and are the baseline for any production system. Multiple **regions** protect against a whole-region outage, a bad regional deploy, or a cloud control plane failure, and they bring users closer to their data. They also introduce the speed of light: a round trip between US East and Europe is roughly 70 to 90 ms, so synchronous coordination across regions is expensive." },
          { type: "p", text: "In **active-passive**, one primary region serves all writes (and usually reads) while a standby region receives replicated data and is promoted when the primary fails. In **active-active**, every region serves live traffic, including writes, for at least some data." },
          { type: "diagram", chart: `graph TD
  U(["Users"]) --> GR{{"Global DNS or Anycast"}}
  GR -->|"all traffic"| P["Primary region US East"]
  GR -.->|"after failover"| S["Standby region US West"]
  P --> PDB[("Primary DB")]
  S --> SDB[("Replica DB")]
  PDB -->|"async replication"| SDB`, caption: "Active-passive: simple consistency, but the standby must be tested regularly or it will fail when needed." },
          { type: "tradeoff", question: "Active-passive or active-active?", a: "Active-passive: a single writer, so no write conflicts and simple application logic, but failover takes minutes, the standby may be stale, and its capacity sits idle.", b: "Active-active: low latency for global users, near-instant failover and capacity always in use, but you must solve write conflicts or partition data by home region, and testing is harder.", verdict: "Start with active-passive (or warm standby) unless the business needs global low-latency writes or near-zero RTO. When going active-active, avoid conflicts by giving each user or tenant a home region rather than allowing writes to the same record everywhere." },
        ],
      },
      {
        id: "rpo-and-rto",
        heading: "RPO and RTO",
        blocks: [
          { type: "p", text: "Two numbers define a disaster recovery plan. **Recovery point objective (RPO)** is how much data you can afford to lose, measured in time: an RPO of 5 minutes means losing the last 5 minutes of writes is acceptable. **Recovery time objective (RTO)** is how long you may be down before service is restored. RPO is driven by replication and backup frequency; RTO by how automated and rehearsed failover is. Both get cheaper to relax and much more expensive to tighten." },
          { type: "table", head: ["Strategy", "Typical RPO", "Typical RTO", "Cost"], rows: [
            ["Backup and restore", "Hours", "Hours to a day", "Lowest: only storage"],
            ["Pilot light", "Minutes", "Tens of minutes", "Low: data replicated, compute off"],
            ["Warm standby", "Seconds to minutes", "Minutes", "Medium: scaled-down copy running"],
            ["Active-active", "Near zero", "Seconds to minutes", "Highest: full capacity in every region"],
          ] },
          { type: "p", text: "Different data deserves different targets. Payment ledgers might need an RPO of zero, which forces **synchronous replication** to a second location before acknowledging a write. A recommendation model can be rebuilt and might accept a day. Ask for these numbers in an interview instead of assuming them, because they decide the architecture." },
          { type: "callout", tone: "warning", title: "Async replication means data loss on failover", text: "With asynchronous replication, promoting the standby discards whatever had not arrived yet. If replication lag is 3 seconds at the time of failure, your real RPO was 3 seconds, regardless of what the plan says. Monitor replication lag as a first-class SLI." },
        ],
      },
      {
        id: "geo-replication-and-conflicts",
        heading: "Geo-replication and conflict resolution",
        blocks: [
          { type: "p", text: "When two regions accept writes to the same record concurrently, they will eventually see each other's updates and must decide what the final value is. There is no free lunch here: either you **prevent conflicts** by coordinating (synchronous consensus across regions, as Spanner and CockroachDB can do at the cost of cross-region latency on writes) or you **resolve conflicts** after the fact." },
          { type: "cards", items: [
            { title: "Last writer wins", text: "Keep the write with the highest timestamp. Simple and used by Cassandra and DynamoDB global tables, but silently drops concurrent updates and depends on clocks." },
            { title: "Home region per entity", text: "Each user, tenant or shard is mastered in exactly one region, and writes are routed there. No conflicts by construction; failover moves the home." },
            { title: "CRDTs", text: "Data types such as counters, sets and maps whose merge is commutative, so all replicas converge without coordination. Good for likes, carts, presence and collaborative editing." },
            { title: "Application merge", text: "Keep both versions (siblings) and let business logic or the user merge them, as Dynamo-style systems with vector clocks allow." },
          ] },
          { type: "p", text: "In practice most designs mix these: user profiles and orders are homed per region, counters use CRDTs, and truly global uniqueness constraints (usernames, inventory for a limited drop) go through a single strongly consistent store, accepting extra latency for those few operations." },
        ],
      },
      {
        id: "failover-routing",
        heading: "DNS and anycast failover",
        blocks: [
          { type: "p", text: "Failing over data is half the job; you also have to move users. **DNS-based failover** (Route 53, Cloud DNS, NS1) health-checks each region and answers queries with the healthy region's address. It is simple but bounded by TTLs and by resolvers and clients that cache longer than told, so keep TTLs short (30 to 60 seconds) on failover records and expect a tail of stragglers. **Anycast** advertises the same IP address from many locations via BGP, so the network itself routes users to the nearest healthy edge; withdrawing a route shifts traffic within seconds. CDNs and global load balancers (Cloudflare, Google Cloud's global LB, AWS Global Accelerator) combine anycast edges with health-checked origin selection." },
          { type: "diagram", chart: `sequenceDiagram
  participant HC as Health Checker
  participant DNS as Global DNS
  participant E as US East
  participant W as US West
  participant U as User
  loop Every 10 seconds
    HC->>E: Health probe
    E-->>HC: Timeout
  end
  HC->>DNS: Mark US East unhealthy
  Note over W: Promote replica DB to primary and scale out
  U->>DNS: Resolve api.example.com after TTL expiry
  DNS-->>U: Address of US West
  U->>W: Requests now served by US West`, caption: "Regional failover: health checks flip DNS, the standby database is promoted, and clients follow after their cached record expires." },
          { type: "p", text: "Two hazards deserve attention. First, avoid **flapping**: require several consecutive failures before failing over, and make failback a deliberate human decision. Second, beware of split brain: if the old primary region is only partitioned, not dead, it may still accept writes. Fence it (revoke its write credentials, or use a consensus-backed leader record) before promoting the standby." },
        ],
      },
      {
        id: "residency-and-backups",
        heading: "Data residency and backup strategies",
        blocks: [
          { type: "p", text: "Regulations such as GDPR and various national data localization laws may require that certain personal data stays within a jurisdiction. That turns region choice into a data-modeling problem: tag records with a residency region, route requests by user region at the edge, keep regional databases separate, and make sure logs, backups, analytics pipelines and support tooling respect the same boundaries. Truly global data such as product catalogs can still replicate everywhere." },
          { type: "p", text: "Replication is **not** a backup. A bad migration, a bug that deletes rows, or ransomware replicates faithfully to every region in seconds. Backups protect against those logical failures:" },
          { type: "list", items: [
            "**3-2-1 rule**: three copies, on two different media or services, with one off-site or in another account.",
            "**Point-in-time recovery**: periodic snapshots plus continuous write-ahead log archiving let you restore to the second before the bad deploy.",
            "**Immutable and isolated**: object-lock or write-once storage in a separate account, so compromised production credentials cannot delete backups.",
            "**Test restores regularly** and measure how long they take. An untested backup is a hope, not a plan, and the restore time is your real RTO.",
            "**Encrypt backups** and manage their keys as carefully as the data, including residency rules.",
          ] },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Ask for **RPO and RTO** before choosing a topology, and map the answer to backup-restore, pilot light, warm standby or active-active. Explain why async replication implies data loss on failover. If you go active-active, say how write conflicts are avoided (home region) or resolved (LWW, CRDTs) and where you deliberately keep strong consistency. Describe traffic failover with DNS TTLs or anycast, guard against split brain, and remember that replication is not backup." },
        ],
      },
    ],
  },
  {
    slug: "security-in-system-design",
    title: "Security in System Design",
    level: "advanced",
    summary: "The security decisions every design review expects: identity with sessions, JWTs, OAuth 2.0 and OIDC, authorization models, encryption, secrets management, abuse protection and least privilege.",
    tags: ["security", "oauth", "jwt", "auth"],
    sections: [
      {
        id: "authn-vs-authz",
        heading: "Authentication vs authorization",
        blocks: [
          { type: "p", text: "**Authentication** answers who you are: a user proves identity with a password plus a second factor, a passkey, or a federated login, and a service proves identity with a client certificate or a workload token. **Authorization** answers what you may do: given an authenticated identity, may it read invoice 812 or delete project 9? They fail differently: an authentication bug lets strangers in, an authorization bug lets legitimate users see each other's data, which is the most common serious vulnerability in real APIs (broken object level authorization)." },
          { type: "p", text: "A clean design centralizes authentication (an identity provider and a gateway that validates tokens) but enforces authorization **close to the data**, in the service that owns the resource, because only it knows that invoice 812 belongs to tenant 4. Never trust identifiers from the request body to decide ownership; derive the caller from the verified token." },
        ],
      },
      {
        id: "sessions-vs-jwt",
        heading: "Sessions vs JWTs",
        blocks: [
          { type: "p", text: "After login the server must recognize the user on later requests. With **server-side sessions**, it stores session data in a store such as Redis and gives the browser an opaque random id in a cookie marked `HttpOnly`, `Secure` and `SameSite`. With **JWTs**, it issues a signed token that carries the claims itself, so any service holding the public key can verify it without a lookup." },
          { type: "code", lang: "json", code: `{
  "iss": "https://auth.example.com",
  "sub": "user_4821",
  "aud": "orders-api",
  "iat": 1760000000,
  "exp": 1760000900,
  "scope": "orders:read orders:write",
  "tenant": "acme"
}`, caption: "A JWT payload. It is signed, not encrypted, so anyone can read it. Never put secrets or sensitive personal data in it." },
          { type: "table", head: ["Property", "Opaque session", "JWT"], rows: [
            ["Verification", "Lookup in session store", "Signature check, no lookup"],
            ["Revocation", "Delete the session, instant", "Hard until expiry: needs short TTL or a denylist"],
            ["Size", "Small id", "Hundreds of bytes to kilobytes per request"],
            ["Cross-service use", "Every service needs the store", "Any service with the public key"],
            ["Best fit", "First-party web apps", "Service-to-service and API access tokens"],
          ] },
          { type: "tradeoff", question: "How long should a JWT access token live?", a: "Long-lived tokens (days): fewer refreshes, but a stolen token is valid for days and logout or permission changes do not take effect.", b: "Short-lived access tokens (5 to 15 minutes) plus a refresh token stored securely and rotated on every use.", verdict: "Short access tokens with rotating refresh tokens. Reuse of an old refresh token signals theft, so revoke the whole token family. Verify `iss`, `aud`, `exp` and the algorithm on every request and never accept `alg: none`." },
        ],
      },
      {
        id: "oauth-and-oidc",
        heading: "OAuth 2.0 and OpenID Connect",
        blocks: [
          { type: "p", text: "**OAuth 2.0** is a delegation protocol: it lets a user grant an application limited access to their resources on another service without sharing a password. The result is an **access token** scoped to specific permissions. **OpenID Connect (OIDC)** is a thin identity layer on top of OAuth that adds an **ID token**, a JWT that tells the application who the user is. Use the ID token to log the user in to your app; use the access token to call APIs. Mixing them up is a classic mistake." },
          { type: "p", text: "For browser and mobile apps, the recommended flow is **authorization code with PKCE**. The app generates a random `code_verifier`, sends its hash (`code_challenge`) with the authorization request, and later proves possession by sending the verifier when exchanging the code. An attacker who intercepts the code cannot redeem it. The older implicit flow, which returned tokens in the URL, is deprecated." },
          { type: "diagram", chart: `sequenceDiagram
  participant U as User Browser
  participant App as Client App
  participant AS as Authorization Server
  participant API as Resource API
  App->>App: Create code_verifier and code_challenge
  App->>U: Redirect to authorize with code_challenge, state, scope
  U->>AS: Login and consent
  AS-->>U: Redirect back with authorization code and state
  U->>App: Deliver code and state
  App->>AS: Exchange code plus code_verifier
  AS->>AS: Check hash of verifier matches challenge
  AS-->>App: Access token, ID token, refresh token
  App->>API: Request with Bearer access token
  API-->>App: Protected data`, caption: "Authorization code with PKCE. The state parameter protects against CSRF on the redirect." },
          { type: "p", text: "For machine-to-machine calls with no user, use the **client credentials** grant, or better, workload identity (SPIFFE, cloud IAM roles, Kubernetes service account tokens) so services never handle long-lived secrets at all." },
        ],
      },
      {
        id: "authorization-models",
        heading: "RBAC, ABAC and relationship-based access",
        blocks: [
          { type: "cards", items: [
            { title: "RBAC", text: "Users get roles (admin, editor, viewer) and roles carry permissions. Easy to audit and explain, but roles multiply when rules depend on context, a problem known as role explosion." },
            { title: "ABAC", text: "Policies evaluate attributes of the user, resource, action and environment: allow if user.department equals doc.department and time is within business hours. Very expressive, harder to audit." },
            { title: "ReBAC", text: "Permissions follow relationships in a graph: you can edit a doc if you are a member of a team that owns its folder. Google Zanzibar and open-source descendants such as SpiceDB and OpenFGA work this way." },
            { title: "Policy engines", text: "Externalize rules into a policy language (OPA with Rego, AWS Cedar) evaluated by a sidecar or library, so policy changes do not require code changes in every service." },
          ] },
          { type: "p", text: "Most products start with RBAC scoped per tenant, add a few attribute checks (ownership, plan tier), and move to ReBAC once sharing and nested hierarchies appear, as in document or project tools." },
        ],
      },
      {
        id: "encryption-and-secrets",
        heading: "Encryption in transit, at rest, and secrets",
        blocks: [
          { type: "p", text: "**In transit**: TLS 1.2 or later everywhere, including inside the network, since the perimeter is not a trust boundary. Between services, **mutual TLS** authenticates both sides; a service mesh can issue and rotate certificates automatically. Use HSTS for browsers." },
          { type: "p", text: "**At rest**: disk and database encryption protect against stolen media and are usually one setting in the cloud. For sensitive fields, use **envelope encryption**: a key management service (AWS KMS, Cloud KMS, Vault) holds a master key that never leaves it; the application encrypts data with a per-record or per-tenant data key and stores that data key encrypted by the master key. Rotation re-wraps data keys instead of re-encrypting all data, and per-tenant keys allow crypto-shredding." },
          { type: "p", text: "**Secrets** (database passwords, API keys, signing keys) belong in a secrets manager, injected at runtime and never committed to git, baked into images or printed in logs. Prefer short-lived, dynamically issued credentials (Vault database secrets, cloud IAM roles) so a leaked credential expires on its own. Hash passwords with a slow, salted algorithm such as Argon2id or bcrypt, never a fast hash like SHA-256." },
        ],
      },
      {
        id: "abuse-and-least-privilege",
        heading: "DDoS, abuse protection and least privilege",
        blocks: [
          { type: "p", text: "Defend in layers. Volumetric and protocol attacks (floods of UDP or SYN packets) are absorbed at the edge by an anycast CDN or cloud DDoS service with far more capacity than you have. Application-layer attacks look like real requests, so they need a WAF, per-IP and per-account rate limits, bot detection and challenges, and caching to keep expensive endpoints off the origin. Business abuse (credential stuffing, card testing, scraping, fake signups) needs rate limits on sensitive actions, breached-password checks, device fingerprints and step-up verification." },
          { type: "p", text: "**Least privilege** limits the blast radius when something is compromised. Each service gets its own identity and only the permissions it needs: the email service can read the notification queue, not the payments database. Humans get just-in-time, audited access instead of standing admin rights. Split environments and accounts, restrict network paths with security groups or network policies, and log every privileged action to append-only storage." },
          { type: "tradeoff", question: "Perimeter security or zero trust?", a: "Perimeter: a strong outer firewall and VPN with an implicitly trusted internal network. Simple, but one compromised host can reach everything.", b: "Zero trust: every request is authenticated and authorized regardless of network location, using mTLS identities and fine-grained policy.", verdict: "Zero trust for anything modern. Keep perimeter controls as an extra layer, never as the only one." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Separate authentication from authorization and enforce authorization in the service that owns the data. Explain sessions vs JWTs including the revocation trade-off, and pick short-lived access tokens with rotating refresh tokens. Walk through **authorization code with PKCE** and the difference between an ID token and an access token. Mention TLS and mTLS, envelope encryption with a KMS, a secrets manager, edge DDoS protection with rate limits, and least-privilege identities per service." },
        ],
      },
    ],
  },
  {
    slug: "time-clocks-and-ordering",
    title: "Time, Clocks and Ordering",
    level: "advanced",
    summary: "Why physical clocks cannot order events across machines, and how Lamport clocks, vector clocks, hybrid logical clocks, TrueTime and practical sequencing give systems the ordering guarantees they need.",
    tags: ["clocks", "ordering", "consistency"],
    sections: [
      {
        id: "wall-clocks-lie",
        heading: "Why wall clocks lie",
        blocks: [
          { type: "p", text: "Every server has a quartz oscillator that drifts, typically by tens of parts per million, which adds up to seconds per day without correction. **NTP** periodically adjusts the clock against reference servers, but its accuracy depends on network delay and is often in the range of milliseconds across a data center and worse across the internet. Corrections can make the clock **jump backwards**, leap seconds can repeat a second, a VM can be paused and resumed, and a misconfigured host can be minutes off." },
          { type: "p", text: "Two practical rules follow. Use a **monotonic clock** (`System.nanoTime`, `performance.now`, `CLOCK_MONOTONIC`) to measure durations and timeouts on one machine, because it never goes backwards. And never use **wall-clock timestamps from different machines** to decide which event happened first, because a skew of a few milliseconds is enough to reorder writes." },
          { type: "callout", tone: "warning", title: "Last writer wins can silently lose data", text: "Node A writes x = 1 at real time 10.000 s but its clock reads 10.005. Node B writes x = 2 at real time 10.002 s with an accurate clock reading 10.002. Under last-writer-wins by timestamp, x = 1 survives even though it happened first, and the later write vanishes without an error." },
        ],
      },
      {
        id: "lamport-clocks",
        heading: "Lamport clocks",
        blocks: [
          { type: "p", text: "Leslie Lamport observed that what systems usually need is not real time but **causality**: if event a could have influenced event b, then a should be ordered before b. This is the **happens-before** relation. A Lamport clock captures it with one integer per process and three rules." },
          { type: "code", lang: "ts", code: `class LamportClock {
  private time = 0;

  tick(): number {
    this.time += 1;
    return this.time;
  }

  send(): number {
    this.time += 1;
    return this.time;
  }

  receive(remoteTime: number): number {
    this.time = Math.max(this.time, remoteTime) + 1;
    return this.time;
  }
}`, caption: "Lamport clock rules: increment on every event and jump past any timestamp you receive." },
          { type: "p", text: "The guarantee is one-directional: if a happens before b, then `L(a) < L(b)`. The converse does not hold: a smaller timestamp does not mean the event came first, because two unrelated events can get any order. Breaking ties with the node id gives a **total order** that is consistent with causality, which is enough for things like ordering lock requests or generating unique, causally safe version numbers. What Lamport clocks cannot do is tell you whether two events were **concurrent**." },
        ],
      },
      {
        id: "vector-clocks",
        heading: "Vector clocks",
        blocks: [
          { type: "p", text: "A **vector clock** keeps one counter per node. A node increments its own entry on each event, attaches the whole vector to messages, and on receive takes the element-wise maximum and then increments its own entry. Comparing two vectors gives three outcomes: V1 happened before V2 if every entry of V1 is less than or equal to V2 and at least one is smaller; the reverse; or neither, which means the events are **concurrent** and may conflict." },
          { type: "diagram", chart: `sequenceDiagram
  participant A as Replica A
  participant B as Replica B
  participant C as Replica C
  A->>A: Write cart v1, clock A1 B0 C0
  A->>B: Replicate cart v1
  B->>B: Add item, clock A1 B1 C0
  A->>A: Remove item, clock A2 B0 C0
  B->>C: Replicate B version
  A->>C: Replicate A version
  Note over C: A2 B0 C0 vs A1 B1 C0, neither dominates, so concurrent
  C->>C: Keep both siblings or merge`, caption: "Vector clocks detect a true conflict that a timestamp would have resolved by silently dropping one write." },
          { type: "p", text: "Amazon's original Dynamo used vector clocks to keep conflicting shopping cart versions as siblings and merge them. The cost is size: the vector grows with the number of writers, so systems prune old entries or use **dotted version vectors** keyed by replica rather than by client. Many modern stores choose LWW for simplicity and use CRDTs where merges matter." },
          { type: "table", head: ["Clock", "Size", "Detects concurrency?", "Close to real time?", "Used by"], rows: [
            ["Wall clock", "1 value", "No", "Yes, but skewed", "Logs, LWW in Cassandra"],
            ["Lamport", "1 integer", "No", "No", "Total ordering, Raft terms are similar in spirit"],
            ["Vector", "1 counter per node", "Yes", "No", "Dynamo, Riak"],
            ["Hybrid logical", "Physical time plus counter", "No", "Yes, within skew", "CockroachDB, YugabyteDB, MongoDB"],
            ["TrueTime", "Time interval", "Orders via commit wait", "Yes, bounded", "Spanner"],
          ] },
        ],
      },
      {
        id: "hlc-and-truetime",
        heading: "Hybrid logical clocks and TrueTime",
        blocks: [
          { type: "p", text: "A **hybrid logical clock (HLC)** combines the two worlds. Each timestamp is a pair of physical time and a logical counter. A node takes the maximum of its physical clock, its last HLC value and any received HLC value; if physical time did not advance past that maximum, it increments the counter. The result respects causality like a Lamport clock, stays within the clock skew bound of real time so it is meaningful to humans and for snapshot reads, and fits in 64 bits. CockroachDB uses HLCs for MVCC timestamps, combined with a maximum allowed clock offset: reads that encounter a value within the uncertainty window restart at a higher timestamp." },
          { type: "p", text: "Google **Spanner** takes a different route with **TrueTime**. GPS receivers and atomic clocks in every data center let the API return an interval `[earliest, latest]` that is guaranteed to contain the true time, with uncertainty usually a few milliseconds. When a transaction commits with timestamp `s`, the leader performs **commit wait**: it does not make the write visible until `TrueTime.now().earliest > s`. After that wait, every future transaction anywhere is guaranteed to get a larger timestamp, which gives **external consistency** (linearizability) across the globe." },
          { type: "diagram", chart: `sequenceDiagram
  participant Cl as Client
  participant L as Spanner Leader
  participant TT as TrueTime
  Cl->>L: Commit transaction
  L->>TT: now
  TT-->>L: Interval earliest 100, latest 107
  L->>L: Choose commit timestamp s = 107
  L->>L: Replicate via Paxos
  loop Until earliest is past 107
    L->>TT: now
  end
  L-->>Cl: Committed at 107, now visible`, caption: "Commit wait: Spanner trades a few milliseconds of latency for timestamps that match real-time order." },
          { type: "tradeoff", question: "Rely on tightly synchronized clocks or purely logical ordering?", a: "Bounded clocks (TrueTime, HLC with max offset): globally meaningful timestamps and consistent snapshots, but correctness depends on clock infrastructure and a node with excessive skew must shut itself down.", b: "Logical ordering only (consensus logs, Lamport or vector clocks): no dependence on time, but no ordering between unrelated groups without extra coordination.", verdict: "Inside one consensus group, the log order is all you need. For cross-shard transactions with snapshot reads, use a database that implements HLC or TrueTime rather than inventing your own." },
        ],
      },
      {
        id: "ordering-in-practice",
        heading: "Ordering and idempotency in practice",
        blocks: [
          { type: "p", text: "Most application designs do not need global ordering, just ordering **per entity**. Kafka guarantees order only within a partition, so choosing the partition key is choosing your ordering scope: key by `orderId` and all events for one order arrive in sequence, while different orders are processed in parallel. Global ordering would mean one partition and one consumer, which caps throughput." },
          { type: "list", items: [
            "**Per-entity sequence numbers**: the producer stamps `orderId` plus `version`; consumers ignore anything not newer than what they stored, which handles duplicates and reordering together.",
            "**Single writer per key**: route all writes for a key to one owner (a partition leader, an actor, a home region) so order is decided in one place.",
            "**Idempotent producers**: Kafka attaches a producer id and sequence number so broker-side retries do not create duplicates within a partition.",
            "**Idempotency keys** for client requests so a retried payment is recognized rather than repeated.",
            "**Retries can reorder**: if message 5 fails and is retried after 6 succeeds, order breaks unless you limit in-flight requests or process strictly per key.",
          ] },
          { type: "p", text: "Exactly-once delivery is not achievable across arbitrary systems, but **effectively-once processing** is: at-least-once delivery, plus idempotent or version-checked writes, plus atomic commit of the consumer offset with the result where the platform supports it (Kafka transactions, or storing offsets in the same database transaction as the output)." },
          { type: "callout", tone: "interview", title: "What interviewers look for", text: "Show that you would not order cross-machine events by wall clock and can explain why (drift, NTP jumps, skew under LWW). Define happens-before, then contrast Lamport clocks (causal order, no concurrency detection) with vector clocks (detect concurrency, grow with nodes). Know HLC and TrueTime at the level of what they guarantee and what commit wait costs. Most importantly, scope ordering to a key, use version numbers and idempotency, and describe effectively-once as at-least-once plus idempotent processing." },
        ],
      },
    ],
  },
];
