# SysDesign Prep

A Next.js course site for system design interviews, from basic to advanced: 60 chapters across 12 modules, with a color-coded diagram in every lesson.

| Track | What it covers |
| --- | --- |
| Getting Started | Course introduction, 8-week roadmap, the 6-step interview framework, core concepts cheat sheet |
| Fundamentals | Networking, APIs, real-time communication, load balancing, caching, CDNs, estimation, SQL vs NoSQL, indexing, replication, sharding, CAP, queues, storage and search |
| HLD Interview Questions | 20 systems (URL shortener to payments). Each has requirements, scale, concepts, HLD diagram, API, LLD class diagram, sequence diagram, Java code, tech stack and trade-offs |
| Low-Level Design | OOP, SOLID, design patterns, the LLD interview approach, and 8 worked problems (Parking Lot, Elevator, Splitwise, BookMyShow and more) |
| Advanced | Consensus, distributed transactions, event-driven architecture, microservices patterns, reliability, multi-region, security, clocks and ordering |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Where things live

| Path | What it holds |
| --- | --- |
| `lib/curriculum.ts` | Module order, chapter list, prev/next and reading time. Start here to reorder or add modules |
| `lib/questions.ts` | The 20 HLD interview questions |
| `lib/content/question-lld-*.ts` | Class diagram, sequence diagram and Java code for each HLD question |
| `lib/content/fundamentals-*.ts`, `lld-*.ts`, `advanced.ts` | Article chapters, written as typed blocks (see `Block` in `lib/types.ts`) |
| `lib/course.ts` | Roadmap, framework, concepts, FAQ and homepage track diagrams |
| `lib/nav.ts` | Lightweight chapter index passed to client components, so chapter text never ships as JavaScript |
| `app/learn/[slug]/page.tsx` | Every chapter page, statically generated |
| `components/` | Top nav, course sidebar, "On this page" panel, bottom action bar, search (⌘K), Mermaid renderer with fullscreen viewer, Shiki code blocks |
| `app/globals.css` | Design tokens (dark-first, light theme supported) and all styles |

## Writing content

Article chapters are arrays of blocks: `p`, `list`, `diagram`, `code`, `table`, `callout`, `tradeoff`, `cards`. Text supports `**bold**` and `` `code` ``.

Diagrams are Mermaid source. In flowcharts the node shape picks the color: `(["Client"])` client, `["Service"]` service, `[("DB")]` database, `{{"Cache"}}` cache/index/edge, `[["Queue"]]` queue/coordinator. Sequence and class diagrams are themed automatically.

Progress ("Complete") and the theme are stored in the browser's localStorage, so they are per device.
