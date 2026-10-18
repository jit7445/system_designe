import type { Article } from "../types";

export const LLD_PART_2: Article[] = [
  // ---------------------------------------------------------------------------
  // 1. Parking lot
  // ---------------------------------------------------------------------------
  {
    slug: "design-parking-lot",
    title: "Design a Parking Lot",
    level: "intermediate",
    summary:
      "Model a multi-floor parking lot with typed spots, tickets, pluggable allocation and pricing, and a spot claim that stays correct when two gates race for the same space.",
    tags: ["lld", "strategy", "concurrency", "classic"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "The parking lot is the most common warm-up LLD question because it tests whether you can turn a fuzzy real-world system into a small set of well-named classes. Spend the first five minutes pinning down scope. Interviewers deliberately leave things vague to see if you ask, so treat the list below as the questions you should raise, not a spec you were handed.",
          },
          {
            type: "list",
            items: [
              "**Functional:** the lot has multiple floors, and each floor has spots of different sizes (small, compact, large).",
              "**Functional:** it accepts motorcycles, cars and trucks. A motorcycle fits any spot, a car needs compact or large, a truck needs large.",
              "**Functional:** a vehicle arriving at an entry gate is assigned a spot and given a ticket. If no suitable spot exists, entry is refused.",
              "**Functional:** at an exit gate the driver presents the ticket, the fee is computed from duration and spot type, payment is collected, and the spot is freed.",
              "**Functional:** the allocation rule (lowest floor first, closest to the gate, smallest fitting spot) and the pricing rule should be swappable.",
            ],
          },
          {
            type: "list",
            items: [
              "**Non-functional:** several entry gates operate at the same time, so two gates must never hand out the same spot.",
              "**Non-functional:** spot lookup should be fast enough for a lot with a few thousand spots, with no full scan per car in the ideal design.",
              "**Non-functional:** the model should be easy to extend with new vehicle types (electric cars needing chargers) without editing many classes.",
            ],
          },
          {
            type: "p",
            text: "**Out of scope** unless asked: reservations made in advance, licence plate recognition hardware, monthly passes, a UI, and a distributed deployment across many lots. Say these out loud so the interviewer knows you thought of them and chose to park them.",
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "p",
            text: "Find the nouns first: lot, floor, spot, vehicle, ticket, gate, payment. Then find the rules that vary: how a spot is picked and how a fee is computed. Rules that vary become interfaces. The lot is composed of floors and floors are composed of spots, so those are composition relationships (a spot does not exist without its floor). A ticket only references a spot and a vehicle, so it is a plain association.",
          },
          {
            type: "diagram",
            chart: `classDiagram
  class ParkingLot {
    -List~Floor~ floors
    -SpotAllocationStrategy allocator
    -PricingStrategy pricing
    +enter(Vehicle v) Ticket
    +exit(String ticketId) long
  }
  class Floor {
    -int number
    -List~ParkingSpot~ spots
  }
  class ParkingSpot {
    -String id
    -SpotType type
    -AtomicReference~Vehicle~ occupant
    +tryOccupy(Vehicle v) boolean
    +release() void
  }
  class Vehicle {
    -String plate
    -VehicleType type
  }
  class Ticket {
    -String id
    -Instant entryTime
  }
  class SpotType {
    <<enumeration>>
    SMALL
    COMPACT
    LARGE
  }
  class SpotAllocationStrategy {
    <<interface>>
    +allocate(List~Floor~ floors, Vehicle v) Optional~ParkingSpot~
  }
  class PricingStrategy {
    <<interface>>
    +fee(Ticket t, Instant exit) long
  }
  class PaymentProcessor {
    <<interface>>
    +charge(String ticketId, long amount) boolean
  }
  class EntryGate {
    +admit(Vehicle v) Ticket
  }
  class ExitGate {
    +release(String ticketId) long
  }
  ParkingLot "1" *-- "many" Floor
  Floor "1" *-- "many" ParkingSpot
  ParkingSpot --> SpotType
  Ticket --> Vehicle
  Ticket --> ParkingSpot
  ParkingLot --> SpotAllocationStrategy
  ParkingLot --> PricingStrategy
  ParkingLot --> PaymentProcessor
  EntryGate --> ParkingLot
  ExitGate --> ParkingLot`,
            caption: "Gates are thin adapters over the lot; allocation, pricing and payment are injected strategies.",
          },
          {
            type: "p",
            text: "Notice what is **not** here: there is no `Car extends Vehicle` hierarchy. Vehicle subclasses would carry no behaviour, only a type tag, so an enum is simpler. If a later requirement gives vehicles real behaviour (an electric car that requests charging), that is the moment to introduce a subclass or a capability flag.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow: a car enters",
        blocks: [
          {
            type: "p",
            text: "The interesting use case is entry, because it contains the race. The gate asks the lot for a spot, the strategy walks candidate spots, and each candidate is claimed with an atomic compare-and-set. If another gate wins that spot first, the strategy simply moves on to the next candidate.",
          },
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant D as Driver
  participant G as EntryGate
  participant L as ParkingLot
  participant A as AllocationStrategy
  participant S as ParkingSpot
  D->>G: arrive(vehicle)
  G->>L: enter(vehicle)
  L->>A: allocate(floors, vehicle)
  loop candidate spots that fit
    A->>S: tryOccupy(vehicle)
    S-->>A: true or false
  end
  alt spot claimed
    A-->>L: spot
    L->>L: create Ticket and store as active
    L-->>G: ticket
    G-->>D: print ticket and open barrier
  else no spot
    A-->>L: empty
    L-->>G: LotFullException
    G-->>D: show lot full
  end`,
            caption: "Entry flow. The claim happens inside the loop so a lost race costs one extra iteration, not a failure.",
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "p",
            text: "The code below keeps the core small: enums for types, a spot that owns its own occupancy atomically, a best-fit allocation strategy, hourly pricing, and a lot that wires them together. Money is a `long` in the smallest currency unit to avoid floating point errors.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Core parking lot classes (Java 17).",
            code: `import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

enum VehicleType { MOTORCYCLE, CAR, TRUCK }

enum SpotType {
    SMALL, COMPACT, LARGE; // declared smallest first, the allocator relies on this order

    boolean fits(VehicleType v) {
        return switch (v) {
            case MOTORCYCLE -> true;
            case CAR -> this != SMALL;
            case TRUCK -> this == LARGE;
        };
    }
}

record Vehicle(String plate, VehicleType type) {}

class ParkingSpot {
    private final String id;
    private final SpotType type;
    private final AtomicReference<Vehicle> occupant = new AtomicReference<>();

    ParkingSpot(String id, SpotType type) {
        this.id = id;
        this.type = type;
    }

    // Only one caller can move the spot from empty to occupied.
    boolean tryOccupy(Vehicle v) { return occupant.compareAndSet(null, v); }
    void release() { occupant.set(null); }
    boolean isFree() { return occupant.get() == null; }
    String id() { return id; }
    SpotType type() { return type; }
}

record Floor(int number, List<ParkingSpot> spots) {}

record Ticket(String id, Vehicle vehicle, ParkingSpot spot, Instant entryTime) {}

interface SpotAllocationStrategy {
    Optional<ParkingSpot> allocate(List<Floor> floors, Vehicle v);
}

class BestFitLowestFloorStrategy implements SpotAllocationStrategy {
    @Override
    public Optional<ParkingSpot> allocate(List<Floor> floors, Vehicle v) {
        for (SpotType size : SpotType.values()) {
            if (!size.fits(v.type())) continue;
            for (Floor floor : floors) {
                for (ParkingSpot spot : floor.spots()) {
                    if (spot.type() == size && spot.isFree() && spot.tryOccupy(v)) {
                        return Optional.of(spot);
                    }
                }
            }
        }
        return Optional.empty();
    }
}

interface PricingStrategy {
    long fee(Ticket ticket, Instant exitTime);
}

class HourlyPricing implements PricingStrategy {
    private final Map<SpotType, Long> ratePerHour;

    HourlyPricing(Map<SpotType, Long> ratePerHour) { this.ratePerHour = Map.copyOf(ratePerHour); }

    @Override
    public long fee(Ticket ticket, Instant exitTime) {
        long minutes = Duration.between(ticket.entryTime(), exitTime).toMinutes();
        long hours = Math.max(1, (minutes + 59) / 60); // any started hour is billed
        return hours * ratePerHour.get(ticket.spot().type());
    }
}

interface PaymentProcessor {
    boolean charge(String ticketId, long amount);
}

class LotFullException extends RuntimeException {
    LotFullException(VehicleType t) { super("No free spot for " + t); }
}

class ParkingLot {
    private final List<Floor> floors;
    private final SpotAllocationStrategy allocator;
    private final PricingStrategy pricing;
    private final PaymentProcessor payments;
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();

    ParkingLot(List<Floor> floors, SpotAllocationStrategy allocator,
               PricingStrategy pricing, PaymentProcessor payments) {
        this.floors = List.copyOf(floors);
        this.allocator = allocator;
        this.pricing = pricing;
        this.payments = payments;
    }

    Ticket enter(Vehicle v) {
        ParkingSpot spot = allocator.allocate(floors, v)
                .orElseThrow(() -> new LotFullException(v.type()));
        Ticket ticket = new Ticket(UUID.randomUUID().toString(), v, spot, Instant.now());
        activeTickets.put(ticket.id(), ticket);
        return ticket;
    }

    long exit(String ticketId) {
        Ticket ticket = activeTickets.get(ticketId);
        if (ticket == null) throw new IllegalArgumentException("Unknown or already closed ticket");
        long amount = pricing.fee(ticket, Instant.now());
        if (!payments.charge(ticketId, amount)) throw new IllegalStateException("Payment declined");
        // remove() returns null for a second concurrent exit, so the spot is released once
        if (activeTickets.remove(ticketId) != null) ticket.spot().release();
        return amount;
    }
}`,
          },
          {
            type: "p",
            text: "`EntryGate` and `ExitGate` are omitted because they only forward to `enter` and `exit` and drive hardware (barrier, printer). Mention them, draw them, but do not spend interview minutes typing them.",
          },
        ],
      },
      {
        id: "design-patterns-used",
        heading: "Design patterns used",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Where", "Why"],
            rows: [
              ["Strategy", "`SpotAllocationStrategy`, `PricingStrategy`", "Allocation and pricing rules change per lot and per business decision; swapping them needs no edit to `ParkingLot`."],
              ["Strategy / Adapter", "`PaymentProcessor`", "Cash, card and UPI providers plug in behind one interface; the lot never knows which one it talks to."],
              ["Composition", "Lot to floors to spots", "Lifecycle is owned top-down, which keeps creation in one place (a builder or factory reading a layout config)."],
              ["Factory (optional)", "Building floors from config", "Lot layout comes from data; a factory keeps constructor noise out of the domain classes."],
              ["Singleton (avoid)", "`ParkingLot`", "Tempting, but it hurts testing. Prefer one instance created at startup and injected where needed."],
            ],
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "p",
            text: "**The race.** Two entry gates run `enter` on different threads. Both see spot `F1-07` as free. Without protection both assign it and two cars meet at the same spot. The fix in the code is to make the spot the owner of its occupancy and claim it with `compareAndSet(null, vehicle)`. Exactly one thread wins; the loser gets `false` and continues to the next candidate. The `isFree()` check before the CAS is just a cheap filter, the CAS is what guarantees correctness.",
          },
          {
            type: "tradeoff",
            question: "How do we stop two gates from claiming the same spot?",
            a: "**Lot-wide lock:** make `enter` synchronized. Trivially correct and easy to explain, but every gate waits for every other gate even when they want spots on different floors.",
            b: "**Per-spot atomic claim:** CAS on each spot. No global contention, losers retry on the next spot, and the lock scope matches the resource being protected.",
            verdict: "Start by saying a synchronized `enter` is correct, then improve to per-spot CAS. In a database-backed version the same idea becomes a conditional `UPDATE spot SET vehicle = ? WHERE id = ? AND vehicle IS NULL` and checking that one row changed.",
          },
          {
            type: "p",
            text: "**Faster lookup.** Scanning every spot is fine for an interview, but you can mention keeping a free-spot queue per `SpotType` per floor (for example a `ConcurrentLinkedDeque<ParkingSpot>`). Allocation becomes a `poll()` and release becomes an `offer()`. The trade is that the queue and the spot state must stay in sync, so the CAS on the spot remains the source of truth.",
          },
          {
            type: "p",
            text: "**Extensions.** An electric spot type with a charger is a new `SpotType` value plus a rule in `fits`. If fitting rules grow complicated, move them out of the enum into a `SpotCompatibilityPolicy`. Peak-hour pricing is a new `PricingStrategy`, possibly a decorator wrapping `HourlyPricing`. A display board showing free counts per floor can subscribe to spot events through a small Observer interface instead of polling.",
          },
          {
            type: "tradeoff",
            question: "Should vehicle types be an enum or a class hierarchy?",
            a: "**Enum:** compact, exhaustive `switch`, easy to persist. Adding a type means editing the enum and the fit rule.",
            b: "**Abstract `Vehicle` with subclasses:** each subclass answers `canFitIn(SpotType)` itself, which follows open-closed more strictly.",
            verdict: "Enum, while vehicles carry no behaviour. Mention that you would switch to polymorphism the moment vehicle-specific behaviour appears.",
          },
        ],
      },
      {
        id: "what-interviewers-look-for",
        heading: "What interviewers look for",
        blocks: [
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Clarifying questions before drawing anything. A small class model where varying rules are interfaces, not `if` chains inside `ParkingLot`. Money as integers, not doubles. A concrete answer to the two-gates race that names the exact atomic step. Bonus points for knowing when not to use inheritance and for keeping gates and hardware at the edge of the design.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. Vending machine
  // ---------------------------------------------------------------------------
  {
    slug: "design-vending-machine",
    title: "Design a Vending Machine",
    level: "intermediate",
    summary:
      "Use the State pattern to model a vending machine that takes coins and notes, dispenses products, returns correct change and refunds on cancel.",
    tags: ["lld", "state-pattern", "classic"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "The vending machine question exists to test one thing above all: can you recognise a state machine and implement it without a forest of `if (state == ...)` checks. The domain is small, so the interviewer expects clean code and correct edge cases such as cancelling midway or not having enough change.",
          },
          {
            type: "list",
            items: [
              "**Functional:** the machine holds products in slots (code like `A1`), each with a price and a quantity.",
              "**Functional:** the user inserts coins and notes of fixed denominations; the running balance is shown.",
              "**Functional:** the user selects a slot. If the balance covers the price and stock exists, the product is dispensed along with change.",
              "**Functional:** if exact change cannot be returned, the sale is refused and the balance stays available (or can be refunded).",
              "**Functional:** the user can cancel at any time before dispensing and gets all inserted money back.",
              "**Functional:** when every slot is empty the machine refuses money entirely. An operator can restock products and coins.",
            ],
          },
          {
            type: "list",
            items: [
              "**Non-functional:** the machine never loses money: every inserted coin is either kept for a sale or returned.",
              "**Non-functional:** it serves one user at a time, but operations must be safe if the hardware fires events on different threads.",
              "**Non-functional:** new states (maintenance mode) or payment types (card) should be addable without rewriting existing states.",
            ],
          },
          {
            type: "p",
            text: "**Out of scope:** card or wallet payments, remote telemetry, multiple selection in one transaction, and hardware drivers. Treat the coin acceptor and dispenser as simple method calls.",
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "p",
            text: "The `VendingMachine` is the context object. It owns an `Inventory` of products, a `CashBox` that counts coins by denomination, the current balance, and a reference to the current `State`. Every user action is delegated to that state object, which decides what is legal and which state comes next.",
          },
          {
            type: "diagram",
            chart: `classDiagram
  class VendingMachine {
    -State state
    -Inventory inventory
    -CashBox cashBox
    -long balance
    +insert(Denomination d) void
    +select(String slot) void
    +cancel() void
    +setState(State s) void
  }
  class State {
    <<interface>>
    +insert(VendingMachine m, Denomination d) void
    +select(VendingMachine m, String slot) void
    +cancel(VendingMachine m) void
  }
  class IdleState
  class HasMoneyState
  class DispensingState
  class OutOfStockState
  class Inventory {
    -Map slots
    +isEmpty() boolean
  }
  class Slot {
    -Product product
    -int quantity
  }
  class Product {
    -String name
    -long price
  }
  class CashBox {
    -EnumMap counts
    +makeChange(long amount) Optional~Map~
  }
  class Denomination {
    <<enumeration>>
    COIN_1
    COIN_5
    NOTE_10
    NOTE_50
  }
  State <|.. IdleState
  State <|.. HasMoneyState
  State <|.. DispensingState
  State <|.. OutOfStockState
  VendingMachine --> State
  VendingMachine *-- Inventory
  VendingMachine *-- CashBox
  Inventory "1" *-- "many" Slot
  Slot --> Product
  CashBox --> Denomination`,
            caption: "The machine delegates every action to its current State object.",
          },
          {
            type: "p",
            text: "States are stateless themselves (all data lives on the machine), so each can be a single shared instance. That is a small but nice detail to point out: it avoids allocating a new state object on every transition.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow: buy a product with change",
        blocks: [
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant U as User
  participant M as VendingMachine
  participant S as CurrentState
  participant I as Inventory
  participant C as CashBox
  U->>M: insert(NOTE_50)
  M->>S: insert(machine, NOTE_50)
  S->>C: deposit(NOTE_50)
  S->>M: setState(HasMoney)
  U->>M: select(A1)
  M->>S: select(machine, A1)
  S->>I: check price and stock
  S->>C: makeChange(balance minus price)
  alt change available
    S->>M: setState(Dispensing)
    S->>I: decrement(A1)
    S->>C: withdraw change coins
    S-->>U: product and change
    S->>M: setState(Idle or OutOfStock)
  else cannot make change
    S-->>U: show exact change only
  end`,
            caption: "Change is computed before anything is dispensed, so a failure leaves stock and money untouched.",
          },
          {
            type: "p",
            text: "The order matters: validate stock, validate balance, compute change, and only then commit. If you dispense first and discover you cannot make change, you have already given away a product. Interviewers often probe exactly this ordering.",
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "code",
            lang: "java",
            caption: "State pattern vending machine with change making (Java 17).",
            code: `import java.util.*;

enum Denomination {
    COIN_1(1), COIN_2(2), COIN_5(5), NOTE_10(10), NOTE_20(20), NOTE_50(50);
    final int value;
    Denomination(int value) { this.value = value; }
}

record Product(String name, long price) {}

class Slot {
    final Product product;
    int quantity;
    Slot(Product product, int quantity) { this.product = product; this.quantity = quantity; }
}

class Inventory {
    private final Map<String, Slot> slots = new HashMap<>();
    void put(String code, Slot slot) { slots.put(code, slot); }
    Optional<Slot> find(String code) { return Optional.ofNullable(slots.get(code)); }
    boolean isEmpty() { return slots.values().stream().allMatch(s -> s.quantity == 0); }
}

class CashBox {
    private final EnumMap<Denomination, Integer> counts = new EnumMap<>(Denomination.class);

    void deposit(Denomination d) { counts.merge(d, 1, Integer::sum); }

    // Greedy from the largest denomination, bounded by the coins we actually hold.
    Optional<Map<Denomination, Integer>> makeChange(long amount) {
        Map<Denomination, Integer> plan = new EnumMap<>(Denomination.class);
        List<Denomination> desc = new ArrayList<>(List.of(Denomination.values()));
        Collections.reverse(desc);
        for (Denomination d : desc) {
            int use = (int) Math.min(amount / d.value, counts.getOrDefault(d, 0));
            if (use > 0) { plan.put(d, use); amount -= (long) use * d.value; }
        }
        return amount == 0 ? Optional.of(plan) : Optional.empty();
    }

    void withdraw(Map<Denomination, Integer> plan) {
        plan.forEach((d, n) -> counts.merge(d, -n, Integer::sum));
    }
}

interface State {
    default void insert(VendingMachine m, Denomination d) { throw new IllegalStateException("Cannot insert now"); }
    default void select(VendingMachine m, String code) { throw new IllegalStateException("Cannot select now"); }
    default void cancel(VendingMachine m) { /* nothing to refund */ }
}

class IdleState implements State {
    @Override public void insert(VendingMachine m, Denomination d) {
        m.acceptMoney(d);
        m.setState(m.hasMoney);
    }
}

class HasMoneyState implements State {
    @Override public void insert(VendingMachine m, Denomination d) { m.acceptMoney(d); }

    @Override public void select(VendingMachine m, String code) {
        Slot slot = m.inventory.find(code).orElseThrow(() -> new IllegalArgumentException("No slot " + code));
        if (slot.quantity == 0) throw new IllegalStateException("Sold out");
        long changeDue = m.balance() - slot.product.price();
        if (changeDue < 0) throw new IllegalStateException("Insert " + (-changeDue) + " more");
        Map<Denomination, Integer> change = m.cashBox.makeChange(changeDue)
                .orElseThrow(() -> new IllegalStateException("Exact change only"));
        m.setState(m.dispensing);
        m.dispense(slot, change);
    }

    @Override public void cancel(VendingMachine m) {
        m.refundAll();
        m.setState(m.idle);
    }
}

// Transient state: blocks input while the hardware is releasing the item.
class DispensingState implements State {}

class OutOfStockState implements State {
    @Override public void insert(VendingMachine m, Denomination d) {
        throw new IllegalStateException("Machine is empty, money rejected");
    }
}

class VendingMachine {
    final State idle = new IdleState(), hasMoney = new HasMoneyState(),
                dispensing = new DispensingState(), outOfStock = new OutOfStockState();
    final Inventory inventory = new Inventory();
    final CashBox cashBox = new CashBox();
    private final List<Denomination> inserted = new ArrayList<>();
    private State state = outOfStock;

    synchronized void insert(Denomination d) { state.insert(this, d); }
    synchronized void select(String code) { state.select(this, code); }
    synchronized void cancel() { state.cancel(this); }

    synchronized void restock(String code, Product p, int qty) {
        inventory.put(code, new Slot(p, qty));
        if (state == outOfStock) state = idle;
    }

    void setState(State next) { this.state = next; }
    long balance() { return inserted.stream().mapToLong(d -> d.value).sum(); }

    void acceptMoney(Denomination d) {
        cashBox.deposit(d);
        inserted.add(d);
    }

    void refundAll() {
        Map<Denomination, Integer> back = new EnumMap<>(Denomination.class);
        inserted.forEach(d -> back.merge(d, 1, Integer::sum));
        cashBox.withdraw(back); // return the very coins the user inserted
        inserted.clear();
    }

    void dispense(Slot slot, Map<Denomination, Integer> change) {
        slot.quantity--;
        cashBox.withdraw(change);
        inserted.clear();
        setState(inventory.isEmpty() ? outOfStock : idle);
    }
}`,
          },
          {
            type: "p",
            text: "Two details worth calling out. First, the `State` interface uses default methods that reject the action, so each concrete state only overrides what it actually allows. That keeps illegal transitions explicit and the classes short. Second, `refundAll` returns the exact coins the user inserted rather than recomputing change, which can never fail because those coins were just deposited.",
          },
        ],
      },
      {
        id: "design-patterns-used",
        heading: "Design patterns used",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Where", "Why"],
            rows: [
              ["State", "`State` with Idle, HasMoney, Dispensing, OutOfStock", "Behaviour depends on mode; each mode becomes a class, removing scattered conditionals and making illegal actions obvious."],
              ["Flyweight-style shared states", "One instance per state on the machine", "States hold no data, so sharing them avoids allocation and makes identity checks like `state == outOfStock` safe."],
              ["Strategy (extension)", "Change-making algorithm", "Greedy works for canonical denominations; a dynamic programming strategy can be swapped in for unusual coin sets."],
              ["Facade", "`VendingMachine` public methods", "Hardware and UI talk to three methods; inventory and cash box stay internal."],
            ],
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "tradeoff",
            question: "State pattern classes or an enum with a switch?",
            a: "**Enum plus switch** in each method: fewer files, everything visible in one place, fine for three or four states with simple rules.",
            b: "**State classes:** each state owns its rules, adding a state means adding a class, and the compiler forces you to think about each action per state.",
            verdict: "Use State classes in the interview because that is what the question is testing, but say that a tiny machine could live with an enum. Knowing both shows judgement.",
          },
          {
            type: "p",
            text: "**Change making.** Greedy (largest coin first) is optimal for canonical systems like 1, 2, 5, 10, 20, 50. It can fail when coin counts are limited: to return 6 with one 5 and three 2s, greedy takes the 5 and is left needing 1. A bounded dynamic programming approach over amounts up to the change due fixes that. Mention this unprompted; it is a classic follow-up.",
          },
          {
            type: "tradeoff",
            question: "What should happen when exact change is impossible?",
            a: "**Refuse the sale** and keep the balance, letting the user pick something else or cancel.",
            b: "**Sell anyway** and keep the difference, or issue a credit voucher.",
            verdict: "Refuse. The non-functional rule is that the machine never takes money it did not earn. A voucher is a business feature to raise, not a default.",
          },
          {
            type: "p",
            text: "**Concurrency.** A physical machine has one user, but coin acceptor interrupts and the keypad can arrive on separate threads. Making the three public entry points `synchronized` serialises them, which is cheap because operations are tiny. A `MaintenanceState` for the operator slots in without touching existing states: it rejects insert and select, and `restock` transitions out of it. Card payment would add a `PaymentMethod` abstraction so that `balance` is no longer just a list of coins.",
          },
        ],
      },
      {
        id: "what-interviewers-look-for",
        heading: "What interviewers look for",
        blocks: [
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A state diagram sketched before code, with every transition named. States that reject illegal actions instead of silently ignoring them. Validation and change calculation before dispensing, never after. Awareness that greedy change can fail with limited coins. A clean refund path that cannot lose money. Integer money everywhere.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. Elevator system
  // ---------------------------------------------------------------------------
  {
    slug: "design-elevator-system",
    title: "Design an Elevator System",
    level: "advanced",
    summary:
      "Design a multi-car elevator controller with a per-car state machine, LOOK-style stop ordering, a pluggable dispatcher and observers for displays.",
    tags: ["lld", "strategy", "observer", "state-machine"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "The elevator question is harder than it looks because it mixes three concerns: a state machine per car, an ordering algorithm for stops inside one car, and a dispatch decision across cars. Candidates who blend these into one giant class struggle. Name the three concerns early and the rest of the interview gets easier.",
          },
          {
            type: "list",
            items: [
              "**Functional:** a building has N floors and M elevator cars.",
              "**Functional:** a hall request comes from a floor with a direction (up or down button). The system assigns it to one car.",
              "**Functional:** a car request comes from inside a car (a floor button) and always goes to that car.",
              "**Functional:** each car serves stops in an efficient order: keep moving in the current direction while there are stops ahead, then reverse (LOOK).",
              "**Functional:** cars can be put into maintenance and then receive no new assignments.",
              "**Functional:** floor displays and car panels show the current floor and direction.",
            ],
          },
          {
            type: "list",
            items: [
              "**Non-functional:** no request is ever starved; every request is eventually served.",
              "**Non-functional:** the dispatch policy can change (rush hour, energy saving) without rewriting car logic.",
              "**Non-functional:** requests arrive concurrently from many buttons while cars move on their own threads or ticks.",
            ],
          },
          {
            type: "p",
            text: "**Out of scope:** motor control, weight sensors, emergency protocols, express zones and destination dispatch kiosks. Model time as discrete ticks: each `step()` moves a car one floor or handles its doors. That keeps the simulation testable without real sleeps.",
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "diagram",
            chart: `classDiagram
  class ElevatorController {
    -List~ElevatorCar~ cars
    -DispatchStrategy strategy
    +hallCall(int floor, Direction dir) void
    +carCall(int carId, int floor) void
    +tick() void
  }
  class ElevatorCar {
    -int id
    -int currentFloor
    -Direction direction
    -CarState state
    -TreeSet~Integer~ upStops
    -TreeSet~Integer~ downStops
    +addStop(int floor) void
    +step() void
  }
  class DispatchStrategy {
    <<interface>>
    +choose(List~ElevatorCar~ cars, HallCall call) ElevatorCar
  }
  class NearestCarStrategy
  class LeastLoadedStrategy
  class HallCall {
    -int floor
    -Direction direction
  }
  class CarState {
    <<enumeration>>
    IDLE
    MOVING
    DOORS_OPEN
    MAINTENANCE
  }
  class Direction {
    <<enumeration>>
    UP
    DOWN
    NONE
  }
  class ElevatorListener {
    <<interface>>
    +onFloorChanged(int carId, int floor, Direction dir) void
    +onDoorsOpened(int carId, int floor) void
  }
  class FloorDisplay
  DispatchStrategy <|.. NearestCarStrategy
  DispatchStrategy <|.. LeastLoadedStrategy
  ElevatorListener <|.. FloorDisplay
  ElevatorController "1" *-- "many" ElevatorCar
  ElevatorController --> DispatchStrategy
  ElevatorController ..> HallCall
  ElevatorCar --> CarState
  ElevatorCar --> Direction
  ElevatorCar o-- ElevatorListener`,
            caption: "The controller dispatches, each car orders its own stops, listeners observe car events.",
          },
          {
            type: "p",
            text: "The key decision is that **a car owns its stop list and its movement**, while the **controller only decides which car gets a hall call**. Car calls bypass the dispatcher entirely. This split means the LOOK ordering and the dispatch policy can be tested and changed independently.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow: a hall call is served",
        blocks: [
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant P as Passenger
  participant C as Controller
  participant S as DispatchStrategy
  participant E as ElevatorCar
  participant D as FloorDisplay
  P->>C: hallCall(floor 7, UP)
  C->>S: choose(cars, call)
  S-->>C: car 2
  C->>E: addStop(7)
  loop every tick until floor 7
    C->>E: step()
    E->>D: onFloorChanged(2, floor, UP)
  end
  E->>E: remove stop 7 and set DOORS_OPEN
  E->>D: onDoorsOpened(2, 7)
  P->>C: carCall(2, floor 12)
  C->>E: addStop(12)
  C->>E: step()
  E->>E: close doors and continue UP`,
            caption: "A hall call goes through the dispatcher once; after boarding, the car call goes straight to the car.",
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "p",
            text: "Stops are kept in two sorted sets: floors above the car (`upStops`) and floors below (`downStops`). Moving up, the next target is the smallest up stop; moving down, it is the largest down stop. When the set for the current direction empties, the car reverses if the other set has stops, otherwise it goes idle. That is the LOOK algorithm: like SCAN, but it turns around at the last request instead of travelling to the end of the shaft.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Elevator car with LOOK ordering, dispatcher strategy and listeners (Java 17).",
            code: `import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

enum Direction { UP, DOWN, NONE }
enum CarState { IDLE, MOVING, DOORS_OPEN, MAINTENANCE }

record HallCall(int floor, Direction direction) {}

interface ElevatorListener {
    void onFloorChanged(int carId, int floor, Direction dir);
    void onDoorsOpened(int carId, int floor);
}

class ElevatorCar {
    private final int id;
    private int currentFloor;
    private Direction direction = Direction.NONE;
    private CarState state = CarState.IDLE;
    private final TreeSet<Integer> upStops = new TreeSet<>();
    private final TreeSet<Integer> downStops = new TreeSet<>();
    private final List<ElevatorListener> listeners = new CopyOnWriteArrayList<>();

    ElevatorCar(int id, int startFloor) { this.id = id; this.currentFloor = startFloor; }

    synchronized void addStop(int floor) {
        if (state == CarState.MAINTENANCE) throw new IllegalStateException("Car " + id + " in maintenance");
        if (floor > currentFloor) upStops.add(floor);
        else if (floor < currentFloor) downStops.add(floor);
        else openDoors(); // already here
    }

    synchronized void step() {
        switch (state) {
            case MAINTENANCE -> { return; }
            case DOORS_OPEN -> state = CarState.IDLE; // doors close after one tick
            default -> { }
        }
        chooseDirection();
        if (direction == Direction.NONE) { state = CarState.IDLE; return; }

        state = CarState.MOVING;
        currentFloor += (direction == Direction.UP) ? 1 : -1;
        listeners.forEach(l -> l.onFloorChanged(id, currentFloor, direction));

        TreeSet<Integer> active = (direction == Direction.UP) ? upStops : downStops;
        if (active.remove(currentFloor)) openDoors();
    }

    // LOOK: keep the current direction while stops remain ahead, else reverse, else idle.
    private void chooseDirection() {
        if (direction == Direction.UP && !upStops.isEmpty()) return;
        if (direction == Direction.DOWN && !downStops.isEmpty()) return;
        if (!upStops.isEmpty()) direction = Direction.UP;
        else if (!downStops.isEmpty()) direction = Direction.DOWN;
        else direction = Direction.NONE;
    }

    private void openDoors() {
        state = CarState.DOORS_OPEN;
        listeners.forEach(l -> l.onDoorsOpened(id, currentFloor));
    }

    synchronized void setMaintenance(boolean on) {
        state = on ? CarState.MAINTENANCE : CarState.IDLE;
        if (on) { upStops.clear(); downStops.clear(); direction = Direction.NONE; }
    }

    void addListener(ElevatorListener l) { listeners.add(l); }
    synchronized int currentFloor() { return currentFloor; }
    synchronized Direction direction() { return direction; }
    synchronized boolean isAvailable() { return state != CarState.MAINTENANCE; }
    synchronized int pendingStops() { return upStops.size() + downStops.size(); }
    int id() { return id; }
}

interface DispatchStrategy {
    Optional<ElevatorCar> choose(List<ElevatorCar> cars, HallCall call);
}

class NearestCarStrategy implements DispatchStrategy {
    @Override
    public Optional<ElevatorCar> choose(List<ElevatorCar> cars, HallCall call) {
        return cars.stream().filter(ElevatorCar::isAvailable)
                .min(Comparator.comparingInt(c -> cost(c, call)));
    }

    // Distance, plus a penalty when the car is heading away from the caller.
    private int cost(ElevatorCar car, HallCall call) {
        int distance = Math.abs(car.currentFloor() - call.floor());
        Direction d = car.direction();
        if (d == Direction.NONE) return distance;
        boolean onTheWay = (d == Direction.UP && call.floor() >= car.currentFloor() && call.direction() == Direction.UP)
                || (d == Direction.DOWN && call.floor() <= car.currentFloor() && call.direction() == Direction.DOWN);
        return onTheWay ? distance : distance + 2 * car.pendingStops() + 10;
    }
}

class ElevatorController {
    private final List<ElevatorCar> cars;
    private volatile DispatchStrategy strategy;

    ElevatorController(List<ElevatorCar> cars, DispatchStrategy strategy) {
        this.cars = List.copyOf(cars);
        this.strategy = strategy;
    }

    void hallCall(int floor, Direction dir) {
        ElevatorCar car = strategy.choose(cars, new HallCall(floor, dir))
                .orElseThrow(() -> new IllegalStateException("No car available"));
        car.addStop(floor);
    }

    void carCall(int carId, int floor) { cars.get(carId).addStop(floor); }
    void setStrategy(DispatchStrategy s) { this.strategy = s; }
    void tick() { cars.forEach(ElevatorCar::step); }
}`,
          },
          {
            type: "p",
            text: "A simplification to admit openly: a hall call stores only the floor, not the requested direction, inside the car. A production controller would store direction with each stop so a car going up does not stop for someone who pressed down. Saying this out loud shows you understand the model's limits without spending ten minutes on it.",
          },
        ],
      },
      {
        id: "design-patterns-used",
        heading: "Design patterns used",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Where", "Why"],
            rows: [
              ["Strategy", "`DispatchStrategy` (nearest car, least loaded, zoning)", "The building owner changes policy by time of day; `setStrategy` swaps it at runtime."],
              ["Observer", "`ElevatorListener`, `FloorDisplay`", "Displays, logging and analytics react to car events without the car knowing about them."],
              ["State machine", "`CarState` transitions in `step()`", "Few states with simple transitions, so an enum is enough. Switch to State classes if per-state behaviour grows."],
              ["Command (optional)", "`HallCall` as a value object", "Requests become objects that can be queued, logged and replayed for testing."],
            ],
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "tradeoff",
            question: "Which stop ordering should a car use?",
            a: "**FCFS (first come, first served):** simplest and fair in arrival order, but the car zigzags and total travel explodes.",
            b: "**SCAN or LOOK:** sweep in one direction, then reverse. Far less travel, and every request is served within at most two sweeps, so nothing starves.",
            verdict: "LOOK. It is what real elevators roughly do. Explain SCAN first (go to the end), then LOOK as the optimisation (turn at the last request).",
          },
          {
            type: "tradeoff",
            question: "Should a hall call be assigned to a car once, or re-evaluated?",
            a: "**Assign once:** simple, deterministic, easy to light the right car indicator.",
            b: "**Re-evaluate on each tick:** keep hall calls in a shared queue and let the dispatcher reassign as cars move, which gives better wait times.",
            verdict: "Assign once for the interview, then mention reassignment as an optimisation and its cost: you must remove the stop from the old car atomically.",
          },
          {
            type: "p",
            text: "**Concurrency.** Buttons are pressed on many threads while cars step on a scheduler thread. Each car guards its own stops with `synchronized`, so locking is per car and a hall call for car 1 never waits on car 2. Listeners are stored in a `CopyOnWriteArrayList` because they are registered rarely and iterated on every floor change. The strategy reference is `volatile` so a swap is visible to all threads. One honest caveat: `NearestCarStrategy` reads several cars' positions without a global lock, so the choice may be slightly stale. That is acceptable because a slightly worse car still serves the call correctly.",
          },
          {
            type: "p",
            text: "**Extensions.** A capacity limit adds a `load` field and a check in the dispatcher. Express zones become a `ZoneDispatchStrategy` that filters cars by the floors they serve. A fire mode can be a controller-level state that sends every car to the ground floor and ignores new calls. Each of these touches one class, which is the evidence that the decomposition was right.",
          },
        ],
      },
      {
        id: "what-interviewers-look-for",
        heading: "What interviewers look for",
        blocks: [
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Clear separation of dispatch (which car) from scheduling (which order) from state (what the car is doing). Hall calls versus car calls handled differently. A named algorithm (SCAN or LOOK) with a starvation argument. Strategy for dispatch with a runtime swap, Observer for displays. A discrete `step()` model that makes the design testable. Honest statements about simplifications.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. Splitwise
  // ---------------------------------------------------------------------------
  {
    slug: "design-splitwise",
    title: "Design Splitwise",
    level: "advanced",
    summary:
      "Design an expense-sharing system with pluggable split types, a consistent balance sheet and a greedy heap-based algorithm that simplifies a group's debts.",
    tags: ["lld", "strategy", "algorithms"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "Splitwise is a favourite at product companies because it combines object modelling with a small algorithm and lots of validation. The traps are rounding, mismatched totals and a balance model that double counts. Get the money representation right first and the rest follows.",
          },
          {
            type: "list",
            items: [
              "**Functional:** users can create groups and add members.",
              "**Functional:** a user adds an expense paid by one person and split among participants: **equal**, **exact amounts** or **percentages**.",
              "**Functional:** the system shows each user's balance with every other user (who owes whom, how much).",
              "**Functional:** a user can record a settlement payment, which reduces a balance.",
              "**Functional:** for a group, the system can suggest a minimal-ish set of payments that settles everyone (simplify debts).",
            ],
          },
          {
            type: "list",
            items: [
              "**Non-functional:** amounts are exact to the paisa or cent. The sum of shares always equals the expense total.",
              "**Non-functional:** invalid expenses (percentages not summing to 100, exact shares not matching the total, unknown users) are rejected with a clear error.",
              "**Non-functional:** new split types (by shares, by adjustment) are added without changing expense handling code.",
              "**Non-functional:** concurrent expense additions in the same group must not corrupt balances.",
            ],
          },
          {
            type: "p",
            text: "**Out of scope:** multi-currency conversion, recurring expenses, notifications, receipts and an actual payment gateway. Mention that currency would be stored on each expense if added later.",
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "diagram",
            chart: `classDiagram
  class User {
    -String id
    -String name
  }
  class Group {
    -String id
    -Set~User~ members
    -List~Expense~ expenses
  }
  class Expense {
    -String id
    -User paidBy
    -long amount
    -List~Split~ splits
  }
  class Split {
    -User user
    -long share
  }
  class SplitStrategy {
    <<interface>>
    +split(long amount, List~User~ users, List~Double~ params) List~Split~
  }
  class EqualSplit
  class ExactSplit
  class PercentSplit
  class BalanceSheet {
    -Map owes
    +apply(Expense e) void
    +settle(User from, User to, long amount) void
    +netBalances() Map
  }
  class DebtSimplifier {
    +simplify(Map net) List~Payment~
  }
  class Payment {
    -String from
    -String to
    -long amount
  }
  SplitStrategy <|.. EqualSplit
  SplitStrategy <|.. ExactSplit
  SplitStrategy <|.. PercentSplit
  Group "1" o-- "many" User
  Group "1" *-- "many" Expense
  Expense "1" *-- "many" Split
  Expense ..> SplitStrategy
  BalanceSheet ..> Expense
  DebtSimplifier ..> Payment`,
            caption: "Split strategies turn raw input into Split objects; the balance sheet only ever sees validated splits.",
          },
          {
            type: "p",
            text: "An important design choice: the expense stores the **computed shares**, not the split type plus parameters. Once an expense is validated, everything downstream (balances, history, simplification) works on plain amounts. The strategy is used only at creation time.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow: add an expense",
        blocks: [
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant U as User
  participant S as ExpenseService
  participant F as SplitStrategyFactory
  participant T as SplitStrategy
  participant B as BalanceSheet
  U->>S: addExpense(group, paidBy, 1000, PERCENT, users, params)
  S->>S: check payer and users are group members
  S->>F: forType(PERCENT)
  F-->>S: PercentSplit
  S->>T: split(1000, users, params)
  alt valid
    T-->>S: list of Split
    S->>S: create Expense
    S->>B: apply(expense)
    B-->>S: balances updated
    S-->>U: expense id
  else invalid
    T-->>S: InvalidSplitException
    S-->>U: error percentages must sum to 100
  end`,
            caption: "Validation happens before any balance changes, so a bad expense leaves no trace.",
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "p",
            text: "Amounts are `long` in the smallest unit. Equal split of 1000 among 3 gives 333, 333 and 334: the leftover units are spread one at a time so the shares always sum to the total. Percent split uses the same remainder trick after flooring each share.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Split strategies, balance sheet and debt simplification (Java 17).",
            code: `import java.util.*;

record User(String id, String name) {}
record Split(User user, long share) {}
record Expense(String id, User paidBy, long amount, List<Split> splits) {}
record Payment(String from, String to, long amount) {}

class InvalidSplitException extends RuntimeException {
    InvalidSplitException(String msg) { super(msg); }
}

interface SplitStrategy {
    // params meaning depends on the strategy: ignored, exact amounts, or percentages
    List<Split> split(long amount, List<User> users, List<Double> params);
}

final class Remainders {
    // Give leftover units one by one so shares add up to the exact total.
    static List<Split> distribute(long amount, List<User> users, long[] base) {
        long left = amount - Arrays.stream(base).sum();
        List<Split> out = new ArrayList<>();
        for (int i = 0; i < users.size(); i++) {
            long extra = (left > 0) ? 1 : 0;
            left -= extra;
            out.add(new Split(users.get(i), base[i] + extra));
        }
        return out;
    }
}

class EqualSplit implements SplitStrategy {
    public List<Split> split(long amount, List<User> users, List<Double> params) {
        if (users.isEmpty()) throw new InvalidSplitException("No participants");
        long[] base = new long[users.size()];
        Arrays.fill(base, amount / users.size());
        return Remainders.distribute(amount, users, base);
    }
}

class ExactSplit implements SplitStrategy {
    public List<Split> split(long amount, List<User> users, List<Double> params) {
        if (params.size() != users.size()) throw new InvalidSplitException("One amount per user");
        long sum = 0;
        List<Split> out = new ArrayList<>();
        for (int i = 0; i < users.size(); i++) {
            long share = Math.round(params.get(i));
            if (share < 0) throw new InvalidSplitException("Negative share");
            sum += share;
            out.add(new Split(users.get(i), share));
        }
        if (sum != amount) throw new InvalidSplitException("Shares " + sum + " do not match total " + amount);
        return out;
    }
}

class PercentSplit implements SplitStrategy {
    public List<Split> split(long amount, List<User> users, List<Double> params) {
        if (params.size() != users.size()) throw new InvalidSplitException("One percentage per user");
        double total = params.stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(total - 100.0) > 1e-6) throw new InvalidSplitException("Percentages must sum to 100");
        long[] base = new long[users.size()];
        for (int i = 0; i < users.size(); i++) base[i] = (long) Math.floor(amount * params.get(i) / 100.0);
        return Remainders.distribute(amount, users, base);
    }
}

class BalanceSheet {
    // net.get(a).get(b) > 0 means a owes b that amount; stored once per ordered pair
    private final Map<String, Map<String, Long>> net = new HashMap<>();

    synchronized void apply(Expense e) {
        String payer = e.paidBy().id();
        for (Split s : e.splits()) {
            if (!s.user().id().equals(payer)) move(s.user().id(), payer, s.share());
        }
    }

    synchronized void settle(String from, String to, long amount) { move(to, from, amount); }

    private void move(String debtor, String creditor, long amount) {
        net.computeIfAbsent(debtor, k -> new HashMap<>()).merge(creditor, amount, Long::sum);
        net.computeIfAbsent(creditor, k -> new HashMap<>()).merge(debtor, -amount, Long::sum);
    }

    synchronized long owes(String a, String b) {
        return net.getOrDefault(a, Map.of()).getOrDefault(b, 0L);
    }

    // Positive means the user should receive money overall, negative means they owe.
    synchronized Map<String, Long> netBalances() {
        Map<String, Long> result = new HashMap<>();
        net.forEach((user, row) -> result.put(user, -row.values().stream().mapToLong(Long::longValue).sum()));
        return result;
    }
}

class DebtSimplifier {
    List<Payment> simplify(Map<String, Long> netBalances) {
        Comparator<Map.Entry<String, Long>> byAmount = Map.Entry.comparingByValue();
        PriorityQueue<Map.Entry<String, Long>> creditors = new PriorityQueue<>(byAmount.reversed());
        PriorityQueue<Map.Entry<String, Long>> debtors = new PriorityQueue<>(byAmount.reversed());
        netBalances.forEach((user, bal) -> {
            if (bal > 0) creditors.add(new AbstractMap.SimpleEntry<>(user, bal));
            else if (bal < 0) debtors.add(new AbstractMap.SimpleEntry<>(user, -bal));
        });

        List<Payment> payments = new ArrayList<>();
        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            var c = creditors.poll();
            var d = debtors.poll();
            long amt = Math.min(c.getValue(), d.getValue());
            payments.add(new Payment(d.getKey(), c.getKey(), amt));
            if (c.getValue() > amt) creditors.add(new AbstractMap.SimpleEntry<>(c.getKey(), c.getValue() - amt));
            if (d.getValue() > amt) debtors.add(new AbstractMap.SimpleEntry<>(d.getKey(), d.getValue() - amt));
        }
        return payments;
    }
}`,
          },
          {
            type: "p",
            text: "The simplifier pairs the largest creditor with the largest debtor, settles the smaller of the two amounts, and pushes back whoever still has a remainder. Each step zeroes at least one person, so a group of n people with non-zero balances needs at most n minus 1 payments. Both heaps are max-heaps on absolute amount; storing debts as positive numbers keeps the comparator identical.",
          },
        ],
      },
      {
        id: "design-patterns-used",
        heading: "Design patterns used",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Where", "Why"],
            rows: [
              ["Strategy", "`SplitStrategy` with Equal, Exact, Percent", "Each split rule has its own validation and math; new rules (by shares) are new classes."],
              ["Factory", "`SplitStrategyFactory.forType(SplitType)`", "Maps the user's chosen split type to a strategy so the service never uses a `switch`."],
              ["Value objects", "`Split`, `Payment`, `Expense` records", "Immutable once created, which makes history and concurrent reads safe."],
              ["Service layer", "`ExpenseService` orchestrating validation and the balance sheet", "Keeps domain objects simple and puts the transaction boundary in one place."],
            ],
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "tradeoff",
            question: "Store pairwise balances or only a net balance per user?",
            a: "**Pairwise map:** answers 'how much does A owe B' directly and supports settling between two specific people. Uses O(n squared) space in the worst case.",
            b: "**Net per user:** one number each, tiny and fast, but it loses who owes whom, so the app cannot show individual relationships.",
            verdict: "Keep pairwise as the source of truth (users expect it) and derive net balances when simplifying. Both views come from the same ledger.",
          },
          {
            type: "tradeoff",
            question: "Is the greedy simplifier optimal?",
            a: "**Greedy max-heap pairing:** O(n log n), at most n minus 1 payments, simple to explain and what real apps use in spirit.",
            b: "**True minimum number of transactions:** requires finding the largest number of disjoint zero-sum subsets, which is NP-hard; exact solutions use backtracking over small groups.",
            verdict: "Greedy, and say clearly that it is not always the global minimum. For groups under about 15 people a backtracking search is feasible if the interviewer pushes.",
          },
          {
            type: "p",
            text: "**Concurrency.** Two members adding expenses at the same moment both update the same pairs. In memory, the balance sheet methods are `synchronized` (or one lock per group, since groups do not share balances). In a database, append expenses to an immutable ledger table and update a balances table inside the same transaction with `UPDATE balance SET amount = amount + ?`, which is atomic per row. Because balances can always be rebuilt from the ledger, a bug in the cache is recoverable.",
          },
          {
            type: "p",
            text: "**Extensions.** A share-based split (2 shares for A, 1 for B) is a new strategy reusing `Remainders`. Editing an expense is reversing the old one (apply with negated shares) and applying the new one, which keeps the ledger honest. Multi-currency stores a currency per expense and keeps balances per currency pair rather than converting silently.",
          },
        ],
      },
      {
        id: "what-interviewers-look-for",
        heading: "What interviewers look for",
        blocks: [
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Money as integers and a rounding rule that makes shares sum exactly. Strategy for split types with validation inside each strategy. A balance model you can explain with a two-person example. The simplify-debts algorithm with heaps, its O(n log n) cost, the n minus 1 bound, and the honest note that the true minimum is NP-hard. A plan for concurrent updates.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. Movie ticket booking
  // ---------------------------------------------------------------------------
  {
    slug: "design-movie-ticket-booking-lld",
    title: "Design a Movie Ticket Booking System (LLD)",
    level: "advanced",
    summary:
      "Build the object model for a BookMyShow-style system with temporary seat locks that expire, a booking state machine and guaranteed no double booking under concurrency.",
    tags: ["lld", "concurrency", "state-machine", "locking"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "At the LLD level this problem is about two things: a clean domain model that separates what a seat **is** (a physical seat in a screen) from what it **is doing** for one show (free, held, sold), and a seat-locking scheme that holds up when hundreds of users click the same seats at the same second for a blockbuster release.",
          },
          {
            type: "list",
            items: [
              "**Functional:** users browse by city, see theatres, screens and shows for a movie.",
              "**Functional:** a user views the seat map for a show and selects one or more seats.",
              "**Functional:** selected seats are held for the user for a fixed window (say 10 minutes) while they pay.",
              "**Functional:** on successful payment the booking is confirmed and seats become sold. On failure, cancel or timeout, the seats are released.",
              "**Functional:** a confirmed booking can be cancelled according to a refund policy.",
            ],
          },
          {
            type: "list",
            items: [
              "**Non-functional:** a seat can never be sold to two users for the same show. This is the hard correctness requirement.",
              "**Non-functional:** holds expire automatically, so abandoned checkouts do not block seats.",
              "**Non-functional:** selecting seats is all-or-nothing: if any seat in the request is taken, none are held.",
              "**Non-functional:** payment providers and pricing (recliner versus regular, weekend surcharge) are pluggable.",
            ],
          },
          {
            type: "p",
            text: "**Out of scope:** search and recommendations, food and beverage add-ons, offers and coupons, the HLD of scaling across regions. If the interviewer wants scale, the companion HLD chapter covers it; here focus on classes and correctness.",
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "diagram",
            chart: `classDiagram
  class City {
    -String name
    -List~Theatre~ theatres
  }
  class Theatre {
    -String id
    -List~Screen~ screens
  }
  class Screen {
    -String id
    -List~Seat~ seats
  }
  class Seat {
    -String id
    -SeatCategory category
  }
  class Movie {
    -String title
    -int durationMins
  }
  class Show {
    -String id
    -Instant startTime
    -Map seats
  }
  class ShowSeat {
    -Seat seat
    -SeatStatus status
    -String heldBy
    -Instant holdExpiry
    +tryHold(String user, Instant until) boolean
  }
  class SeatStatus {
    <<enumeration>>
    AVAILABLE
    HELD
    BOOKED
  }
  class Booking {
    -String id
    -BookingStatus status
    -List~ShowSeat~ seats
    -long amount
  }
  class BookingStatus {
    <<enumeration>>
    PENDING_PAYMENT
    CONFIRMED
    EXPIRED
    CANCELLED
  }
  class PaymentGateway {
    <<interface>>
    +charge(String bookingId, long amount) boolean
  }
  City "1" *-- "many" Theatre
  Theatre "1" *-- "many" Screen
  Screen "1" *-- "many" Seat
  Show --> Movie
  Show --> Screen
  Show "1" *-- "many" ShowSeat
  ShowSeat --> Seat
  ShowSeat --> SeatStatus
  Booking --> BookingStatus
  Booking "1" o-- "many" ShowSeat
  Booking ..> PaymentGateway`,
            caption: "Seat is physical and reused across shows; ShowSeat is the per-show state that gets locked and sold.",
          },
          {
            type: "p",
            text: "**`ShowSeat` is the most important class in the design.** Putting status on `Seat` is the most common mistake: a seat in Screen 2 is free for the 6 pm show and sold for the 9 pm show at the same time. A `ShowSeat` exists once per seat per show and is the unit that gets held, booked and released.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow: hold seats, pay, confirm",
        blocks: [
          {
            type: "diagram",
            chart: `sequenceDiagram
  participant U as User
  participant B as BookingService
  participant L as SeatLockService
  participant S as Show
  participant P as PaymentGateway
  U->>B: selectSeats(show, A5 A6)
  B->>L: holdAll(show, seats, user, 10 min)
  L->>S: tryHold each seat in sorted order
  alt all seats held
    L-->>B: true
    B->>B: create Booking PENDING_PAYMENT
    B-->>U: booking id and expiry time
    U->>B: pay(bookingId)
    B->>B: check booking not expired
    B->>P: charge(bookingId, amount)
    alt payment ok
      B->>S: mark seats BOOKED for this user
      B-->>U: CONFIRMED
    else payment failed
      B->>L: release(seats)
      B-->>U: payment failed, seats released
    end
  else some seat taken
    L->>S: roll back seats held in this call
    L-->>B: false
    B-->>U: seats no longer available
  end`,
            caption: "Holding is all-or-nothing; confirmation re-checks the hold so an expired hold cannot be sold.",
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "p",
            text: "The in-memory version below locks each `ShowSeat` individually and always acquires seats in sorted id order. Sorting is what prevents deadlock when user A requests seats 5 and 6 while user B requests 6 and 5. Expiry is lazy: a held seat whose `holdExpiry` has passed is treated as available on the next attempt, so no background sweeper is needed for correctness.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Show seats, seat locking and booking state machine (Java 17).",
            code: `import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

enum SeatStatus { AVAILABLE, HELD, BOOKED }
enum BookingStatus { PENDING_PAYMENT, CONFIRMED, EXPIRED, CANCELLED }

record Seat(String id, String category) {}

class ShowSeat {
    private final Seat seat;
    private final long price;
    private SeatStatus status = SeatStatus.AVAILABLE;
    private String heldBy;
    private Instant holdExpiry;

    ShowSeat(Seat seat, long price) { this.seat = seat; this.price = price; }

    synchronized boolean tryHold(String user, Instant now, Instant until) {
        boolean expiredHold = status == SeatStatus.HELD && holdExpiry.isBefore(now);
        if (status == SeatStatus.AVAILABLE || expiredHold) {
            status = SeatStatus.HELD;
            heldBy = user;
            holdExpiry = until;
            return true;
        }
        return false;
    }

    synchronized boolean confirm(String user, Instant now) {
        if (status != SeatStatus.HELD || !user.equals(heldBy) || holdExpiry.isBefore(now)) return false;
        status = SeatStatus.BOOKED;
        return true;
    }

    synchronized void release(String user) {
        if (status == SeatStatus.HELD && user.equals(heldBy)) {
            status = SeatStatus.AVAILABLE;
            heldBy = null;
        }
    }

    String id() { return seat.id(); }
    long price() { return price; }
}

class Show {
    final String id;
    private final Map<String, ShowSeat> seats;
    Show(String id, Map<String, ShowSeat> seats) { this.id = id; this.seats = Map.copyOf(seats); }

    List<ShowSeat> seatsSorted(Collection<String> ids) {
        return ids.stream().sorted().map(sid -> Optional.ofNullable(seats.get(sid))
                .orElseThrow(() -> new IllegalArgumentException("Unknown seat " + sid))).toList();
    }
}

class Booking {
    final String id = UUID.randomUUID().toString();
    final String user;
    final List<ShowSeat> seats;
    final Instant expiresAt;
    private BookingStatus status = BookingStatus.PENDING_PAYMENT;

    Booking(String user, List<ShowSeat> seats, Instant expiresAt) {
        this.user = user; this.seats = seats; this.expiresAt = expiresAt;
    }

    synchronized void transition(BookingStatus from, BookingStatus to) {
        if (status != from) throw new IllegalStateException(status + " cannot move to " + to);
        status = to;
    }

    synchronized BookingStatus status() { return status; }
    long amount() { return seats.stream().mapToLong(ShowSeat::price).sum(); }
}

interface PaymentGateway { boolean charge(String bookingId, long amount); }

class BookingService {
    private static final Duration HOLD = Duration.ofMinutes(10);
    private final PaymentGateway gateway;
    private final Clock clock;
    private final Map<String, Booking> bookings = new ConcurrentHashMap<>();

    BookingService(PaymentGateway gateway, Clock clock) { this.gateway = gateway; this.clock = clock; }

    Booking hold(Show show, Set<String> seatIds, String user) {
        Instant now = clock.instant();
        List<ShowSeat> wanted = show.seatsSorted(seatIds);
        List<ShowSeat> held = new ArrayList<>();
        for (ShowSeat s : wanted) {
            if (!s.tryHold(user, now, now.plus(HOLD))) {
                held.forEach(h -> h.release(user)); // all or nothing
                throw new IllegalStateException("Seat " + s.id() + " is not available");
            }
            held.add(s);
        }
        Booking b = new Booking(user, held, now.plus(HOLD));
        bookings.put(b.id, b);
        return b;
    }

    BookingStatus pay(String bookingId) {
        Booking b = Objects.requireNonNull(bookings.get(bookingId), "Unknown booking");
        Instant now = clock.instant();
        if (now.isAfter(b.expiresAt)) {
            b.transition(BookingStatus.PENDING_PAYMENT, BookingStatus.EXPIRED);
            b.seats.forEach(s -> s.release(b.user));
            return BookingStatus.EXPIRED;
        }
        if (!gateway.charge(b.id, b.amount())) {
            b.transition(BookingStatus.PENDING_PAYMENT, BookingStatus.CANCELLED);
            b.seats.forEach(s -> s.release(b.user));
            return BookingStatus.CANCELLED;
        }
        // Charged: confirm seats. A false here means the hold lapsed mid-payment, so refund.
        boolean allConfirmed = b.seats.stream().allMatch(s -> s.confirm(b.user, now));
        if (!allConfirmed) throw new IllegalStateException("Hold lost during payment, refund required");
        b.transition(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);
        return BookingStatus.CONFIRMED;
    }
}`,
          },
          {
            type: "p",
            text: "Injecting a `Clock` is a small touch that interviewers like: it makes the expiry logic unit-testable with `Clock.fixed` instead of sleeping for ten minutes. The booking state machine is enforced by `transition(from, to)`, which refuses any move that does not start from the expected state. That single method blocks bugs such as confirming an already expired booking.",
          },
        ],
      },
      {
        id: "design-patterns-used",
        heading: "Design patterns used",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Where", "Why"],
            rows: [
              ["State machine", "`BookingStatus` with guarded `transition`", "Bookings move PENDING_PAYMENT to CONFIRMED, EXPIRED or CANCELLED only; guards make illegal moves fail loudly."],
              ["Strategy", "`PaymentGateway`, and a `PricingStrategy` for seat prices", "Payment providers and pricing rules vary by region and business; the booking flow stays the same."],
              ["Composition", "City to Theatre to Screen to Seat", "Physical layout is owned top-down and changes rarely."],
              ["Separation of identity and state", "`Seat` versus `ShowSeat`", "One physical seat, many per-show states. The core modelling insight of the problem."],
              ["Observer (extension)", "Booking events to notifications and analytics", "Email, SMS and loyalty points react to `BookingConfirmed` without changing the service."],
            ],
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "p",
            text: "**Why double booking happens.** Two requests read seat A5 as AVAILABLE, both decide it is free, both write HELD. The read and the write must be one atomic step. In memory that step is the `synchronized tryHold`. In a database it is either a row lock or a conditional write, and this is the decision interviewers most want you to discuss.",
          },
          {
            type: "tradeoff",
            question: "Pessimistic or optimistic locking for seat holds?",
            a: "**Pessimistic:** `SELECT ... FROM show_seat WHERE show_id = ? AND seat_id IN (...) ORDER BY seat_id FOR UPDATE`, check all are free, update, commit. Correct and simple to reason about, but rows stay locked for the transaction and a hot show creates lock queues.",
            b: "**Optimistic:** `UPDATE show_seat SET status = 'HELD', held_by = ?, version = version + 1 WHERE id = ? AND (status = 'AVAILABLE' OR hold_expiry < now())` and check the affected row count. No waiting; losers fail fast and see 'seat taken'.",
            verdict: "Optimistic conditional updates for the hold, since contention per seat is short and failing fast is the right UX. Keep the transaction tiny. Pessimistic locking is a fine first answer if you explain why it struggles at a blockbuster's opening minute.",
          },
          {
            type: "tradeoff",
            question: "Where should temporary holds live?",
            a: "**Database rows with an expiry column:** one source of truth, expiry checked lazily in the conditional update, durable across restarts.",
            b: "**Redis keys with TTL** (`SET seat:show:A5 user NX PX 600000`): very fast and expiry is automatic, but now two systems must agree, and the final booking still needs a database guarantee.",
            verdict: "Either works if the **final** write is protected by a unique constraint on (show_id, seat_id) in the booked seats table. That constraint is the last line of defence that makes double booking impossible even if the hold layer has a bug.",
          },
          {
            type: "p",
            text: "**Deadlocks and partial holds.** Always acquire seats in a consistent order (sorted seat ids) and roll back seats held in the same request if any one fails. **Expiry races.** A user may pay at minute 9:59 while their hold lapses at 10:00. The code re-checks the hold inside `confirm` after charging; if it was lost, issue a refund. Some systems instead extend the hold briefly once payment starts, which is a reasonable product choice to mention.",
          },
          {
            type: "p",
            text: "**Extensions.** Seat categories with different prices become a `PricingStrategy` taking show, seat category and day. Cancellation of a confirmed booking adds CONFIRMED to CANCELLED with a refund policy object. A waitlist can observe seat releases. None of these require changing `ShowSeat` locking, which is a good sign the core is right.",
          },
        ],
      },
      {
        id: "what-interviewers-look-for",
        heading: "What interviewers look for",
        blocks: [
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "The `Seat` versus `ShowSeat` split, stated early. Holds with expiry and an all-or-nothing hold over several seats. A precise answer to double booking: the atomic check-and-set, sorted lock order, and a unique constraint as the final guard. A comparison of optimistic and pessimistic locking with a reasoned choice. A guarded booking state machine and a story for payment succeeding after the hold expired.",
          },
        ],
      },
    ],
  },
];
