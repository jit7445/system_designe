import type { Article } from "../types";

export const LLD_PART_1: Article[] = [
  // 1. OOP fundamentals
  {
    slug: "oop-fundamentals",
    title: "OOP Fundamentals for LLD",
    level: "basic",
    summary:
      "The four pillars of object-oriented programming, composition over inheritance, and when to reach for an interface versus an abstract class.",
    tags: ["oop", "java", "fundamentals"],
    sections: [
      {
        id: "why-oop-matters",
        heading: "Why OOP is the language of LLD rounds",
        blocks: [
          {
            type: "p",
            text: "A low-level design round is really a test of how well you model a problem with objects. The interviewer wants to see classes with clear responsibilities, state that is protected from misuse, and behaviour that can change without rewriting everything. Every one of those goals maps to a core OOP idea, so it pays to be precise about the vocabulary before you start drawing boxes.",
          },
          {
            type: "cards",
            items: [
              {
                title: "Encapsulation",
                text: "Keep state private and expose only operations that keep it valid.",
              },
              {
                title: "Abstraction",
                text: "Show callers what an object does, hide how it does it.",
              },
              {
                title: "Inheritance",
                text: "Reuse and specialise behaviour through an **is-a** relationship.",
              },
              {
                title: "Polymorphism",
                text: "One call site, many implementations chosen at runtime.",
              },
            ],
          },
        ],
      },
      {
        id: "encapsulation-and-abstraction",
        heading: "Encapsulation and abstraction",
        blocks: [
          {
            type: "p",
            text: "**Encapsulation** means an object owns its data and is the only one allowed to change it. Fields are `private`, and the public methods enforce the rules (invariants). A common interview mistake is generating getters and setters for every field, which technically uses `private` but leaks all control back to the caller.",
          },
          {
            type: "code",
            lang: "java",
            caption: "The balance can only change through methods that check the rules.",
            code: `public class Wallet {
    private final String ownerId;
    private long balanceCents;

    public Wallet(String ownerId) {
        this.ownerId = ownerId;
    }

    public void credit(long amountCents) {
        if (amountCents <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        balanceCents += amountCents;
    }

    public void debit(long amountCents) {
        if (amountCents > balanceCents) {
            throw new IllegalStateException("insufficient balance");
        }
        balanceCents -= amountCents;
    }

    public long getBalanceCents() {
        return balanceCents;
    }
}`,
          },
          {
            type: "p",
            text: "Notice there is no `setBalanceCents`. That absence is the design. **Abstraction** is the complementary idea at the type level: callers depend on a small contract such as `PaymentGateway.charge(amount)` and never learn whether the implementation talks to a card network, a UPI switch or an in-memory fake used in tests.",
          },
        ],
      },
      {
        id: "inheritance-and-polymorphism",
        heading: "Inheritance and polymorphism",
        blocks: [
          {
            type: "p",
            text: "**Inheritance** lets a subclass reuse and extend a parent. It is appropriate when the subclass truly is a specialised version of the parent and can be used anywhere the parent is expected. **Polymorphism** is what makes inheritance and interfaces useful: code written against the parent type works with any subtype, and the JVM picks the right method at runtime (dynamic dispatch, also called runtime polymorphism or overriding).",
          },
          {
            type: "code",
            lang: "java",
            caption: "Checkout never changes when a new payment method is added.",
            code: `interface PaymentMethod {
    boolean pay(long amountCents);
}

class CardPayment implements PaymentMethod {
    private final String cardToken;

    CardPayment(String cardToken) { this.cardToken = cardToken; }

    @Override
    public boolean pay(long amountCents) {
        System.out.println("Charging card " + cardToken + " for " + amountCents);
        return true;
    }
}

class UpiPayment implements PaymentMethod {
    private final String vpa;

    UpiPayment(String vpa) { this.vpa = vpa; }

    @Override
    public boolean pay(long amountCents) {
        System.out.println("Collect request to " + vpa + " for " + amountCents);
        return true;
    }
}

class Checkout {
    boolean complete(PaymentMethod method, long amountCents) {
        return method.pay(amountCents);
    }
}`,
          },
          {
            type: "p",
            text: "Overloading (same method name, different parameter lists, resolved at compile time) is sometimes called compile-time polymorphism. Interviewers occasionally ask for the difference: overloading is chosen by the compiler from the declared argument types, overriding is chosen by the JVM from the actual object type.",
          },
          {
            type: "diagram",
            caption: "Checkout depends only on the PaymentMethod abstraction.",
            chart: `classDiagram
  class PaymentMethod {
    <<interface>>
    +pay(long amountCents) boolean
  }
  class CardPayment {
    -String cardToken
    +pay(long amountCents) boolean
  }
  class UpiPayment {
    -String vpa
    +pay(long amountCents) boolean
  }
  class Checkout {
    +complete(PaymentMethod method, long amountCents) boolean
  }
  PaymentMethod <|.. CardPayment
  PaymentMethod <|.. UpiPayment
  Checkout ..> PaymentMethod`,
          },
        ],
      },
      {
        id: "composition-over-inheritance",
        heading: "Composition over inheritance",
        blocks: [
          {
            type: "p",
            text: "Inheritance couples a subclass to every detail of its parent, and Java only allows one parent class. When behaviour varies along more than one axis, subclassing explodes. Imagine notifications that can go over email, SMS or push, and can be either instant or batched. With inheritance you end up with `InstantEmailNotifier`, `BatchedSmsNotifier` and so on, one class per combination. With composition, a `Notifier` simply **has** a channel and a delivery policy.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Behaviour is plugged in, not inherited, so combinations are free.",
            code: `interface Channel {
    void send(String userId, String message);
}

interface DeliveryPolicy {
    void deliver(Runnable sendAction);
}

class Notifier {
    private final Channel channel;
    private final DeliveryPolicy policy;

    Notifier(Channel channel, DeliveryPolicy policy) {
        this.channel = channel;
        this.policy = policy;
    }

    void notify(String userId, String message) {
        policy.deliver(() -> channel.send(userId, message));
    }
}`,
          },
          {
            type: "tradeoff",
            question: "Should a new variant be a subclass or a composed component?",
            a: "Inheritance: less wiring, natural when there is a genuine is-a relationship and a single axis of variation.",
            b: "Composition: swappable at runtime, testable with fakes, avoids class explosion when behaviour varies along several axes.",
            verdict: "Default to composition plus interfaces. Use inheritance for true specialisations, often via an abstract base class that holds shared state.",
          },
        ],
      },
      {
        id: "interface-vs-abstract-class",
        heading: "Interfaces vs abstract classes",
        blocks: [
          {
            type: "p",
            text: "Since Java 8 interfaces can have `default` and `static` methods, so the line has blurred. The practical rule: an **interface** describes a capability that unrelated classes can share, while an **abstract class** is a partially built parent for a family of closely related classes that share state.",
          },
          {
            type: "table",
            head: ["Aspect", "Interface", "Abstract class"],
            rows: [
              ["Instance fields", "No (only `public static final` constants)", "Yes, any visibility"],
              ["Constructors", "No", "Yes, called via `super(...)`"],
              ["Multiple per class", "A class can implement many", "A class can extend only one"],
              ["Method bodies", "`default`, `static`, `private` (Java 9+)", "Any concrete or abstract methods"],
              ["Typical use", "Role or capability: `Comparable`, `PaymentMethod`", "Shared skeleton: `Vehicle` with plate and owner"],
              ["LLD signal", "Extension point, Strategy, testing seam", "Template Method, shared validation"],
            ],
          },
          {
            type: "code",
            lang: "java",
            caption: "Abstract base holds shared state, interface marks a capability.",
            code: `interface Chargeable {
    void startCharging();
}

abstract class Vehicle {
    protected final String plate;

    protected Vehicle(String plate) {
        this.plate = plate;
    }

    abstract int wheelCount();
}

class ElectricCar extends Vehicle implements Chargeable {
    ElectricCar(String plate) { super(plate); }

    @Override int wheelCount() { return 4; }

    @Override public void startCharging() {
        System.out.println(plate + " is charging");
    }
}`,
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "They want to see private fields with behaviour-rich methods instead of getter and setter bags, interfaces at the points where requirements are likely to change, and a quick justification whenever you choose inheritance. Saying 'I will make this an interface so we can add a new payment type without touching Checkout' scores far better than reciting definitions.",
          },
        ],
      },
    ],
  },

  // 2. SOLID
  {
    slug: "solid-principles",
    title: "SOLID Principles with Java Examples",
    level: "basic",
    summary:
      "The five SOLID principles, each shown as a before and after Java refactor with a note on how it surfaces in LLD interviews.",
    tags: ["solid", "java", "design-principles"],
    sections: [
      {
        id: "overview",
        heading: "SOLID at a glance",
        blocks: [
          {
            type: "p",
            text: "SOLID is a set of five guidelines for keeping object-oriented code easy to change. You will rarely be asked to define them in isolation. Instead, interviewers notice when your design violates one, then ask what happens when a new requirement arrives. Knowing the principles lets you anticipate those follow-ups.",
          },
          {
            type: "table",
            head: ["Letter", "Principle", "One-line meaning", "Smell that violates it"],
            rows: [
              ["S", "Single Responsibility", "A class has one reason to change", "A `Manager` class that validates, saves and emails"],
              ["O", "Open/Closed", "Add behaviour by adding code, not editing it", "Growing `if/else` or `switch` on a type field"],
              ["L", "Liskov Substitution", "Subtypes must honour the parent contract", "Overrides that throw `UnsupportedOperationException`"],
              ["I", "Interface Segregation", "Clients should not depend on methods they do not use", "Empty or no-op method implementations"],
              ["D", "Dependency Inversion", "Depend on abstractions, inject concretions", "`new MySqlRepository()` inside business logic"],
            ],
          },
        ],
      },
      {
        id: "single-responsibility",
        heading: "S: Single Responsibility Principle",
        blocks: [
          {
            type: "p",
            text: "A responsibility is a reason to change. If the tax rules, the PDF layout and the email provider can each force edits to the same class, that class has three responsibilities.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Before: one class, three reasons to change.",
            code: `class InvoiceService {
    double computeTotal(Invoice inv) { /* tax and discount rules */ return 0; }
    byte[] renderPdf(Invoice inv) { /* layout code */ return new byte[0]; }
    void emailToCustomer(Invoice inv, byte[] pdf) { /* SMTP code */ }
}`,
          },
          {
            type: "code",
            lang: "java",
            caption: "After: each class changes for exactly one reason.",
            code: `class InvoiceCalculator {
    double computeTotal(Invoice inv) { return 0; }
}

class InvoiceRenderer {
    byte[] renderPdf(Invoice inv) { return new byte[0]; }
}

class InvoiceMailer {
    void send(Invoice inv, byte[] pdf) { }
}`,
          },
          {
            type: "p",
            text: "**In interviews:** split your god class early, for example `ParkingLot` should not also compute fees; give that to a `FeeCalculator`.",
          },
        ],
      },
      {
        id: "open-closed",
        heading: "O: Open/Closed Principle",
        blocks: [
          {
            type: "p",
            text: "Code should be open for extension but closed for modification. When a new variant arrives you add a class instead of editing a tested method.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Before: every new discount type edits this method.",
            code: `class DiscountCalculator {
    double apply(String type, double amount) {
        if (type.equals("FESTIVE")) return amount * 0.8;
        if (type.equals("LOYALTY")) return amount - 50;
        return amount;
    }
}`,
          },
          {
            type: "code",
            lang: "java",
            caption: "After: a new discount is a new class.",
            code: `interface DiscountRule {
    double apply(double amount);
}

class FestiveDiscount implements DiscountRule {
    public double apply(double amount) { return amount * 0.8; }
}

class LoyaltyDiscount implements DiscountRule {
    public double apply(double amount) { return Math.max(0, amount - 50); }
}

class DiscountCalculator {
    double apply(DiscountRule rule, double amount) {
        return rule.apply(amount);
    }
}`,
          },
          {
            type: "p",
            text: "**In interviews:** this is the answer to 'how would you add a new vehicle type, fee model or payment method?' The follow-up question is almost guaranteed.",
          },
        ],
      },
      {
        id: "liskov-substitution",
        heading: "L: Liskov Substitution Principle",
        blocks: [
          {
            type: "p",
            text: "If code works with a parent type, it must keep working with any subtype. Subclasses must not strengthen preconditions, weaken postconditions or throw where the parent promised to succeed.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Before: a fixed deposit pretends to be a withdrawable account.",
            code: `class Account {
    protected long balance;
    void withdraw(long amount) { balance -= amount; }
}

class FixedDeposit extends Account {
    @Override
    void withdraw(long amount) {
        throw new UnsupportedOperationException("locked until maturity");
    }
}`,
          },
          {
            type: "code",
            lang: "java",
            caption: "After: only types that can withdraw expose withdraw.",
            code: `abstract class Account {
    protected long balance;
    long getBalance() { return balance; }
}

abstract class WithdrawableAccount extends Account {
    void withdraw(long amount) { balance -= amount; }
}

class SavingsAccount extends WithdrawableAccount { }

class FixedDeposit extends Account {
    void closeOnMaturity() { }
}`,
          },
          {
            type: "p",
            text: "**In interviews:** if a subclass needs to throw or silently ignore an inherited method, say so out loud and fix the hierarchy instead.",
          },
        ],
      },
      {
        id: "interface-segregation",
        heading: "I: Interface Segregation Principle",
        blocks: [
          {
            type: "p",
            text: "Large interfaces force implementers to provide methods they cannot support. Split them by client need so each class implements only what it actually does.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Before: a basic speaker has to fake video and recording.",
            code: `interface MediaDevice {
    void playAudio(String track);
    void playVideo(String file);
    void record(int seconds);
}

class BasicSpeaker implements MediaDevice {
    public void playAudio(String track) { System.out.println("Playing " + track); }
    public void playVideo(String file) { }
    public void record(int seconds) { }
}`,
          },
          {
            type: "code",
            lang: "java",
            caption: "After: small role interfaces, combined only where needed.",
            code: `interface AudioPlayer { void playAudio(String track); }
interface VideoPlayer { void playVideo(String file); }
interface Recorder { void record(int seconds); }

class BasicSpeaker implements AudioPlayer {
    public void playAudio(String track) { System.out.println("Playing " + track); }
}

class SmartDisplay implements AudioPlayer, VideoPlayer, Recorder {
    public void playAudio(String track) { }
    public void playVideo(String file) { }
    public void record(int seconds) { }
}`,
          },
          {
            type: "p",
            text: "**In interviews:** in a vending machine or elevator design, separate admin operations (restock, maintenance) from user operations rather than one giant interface.",
          },
        ],
      },
      {
        id: "dependency-inversion",
        heading: "D: Dependency Inversion Principle",
        blocks: [
          {
            type: "p",
            text: "High-level policy should not depend on low-level details. Both should depend on an abstraction, and the concrete class is handed in from outside (constructor injection is the simplest form).",
          },
          {
            type: "code",
            lang: "java",
            caption: "Before: business logic is welded to MySQL.",
            code: `class OrderService {
    private final MySqlOrderRepository repo = new MySqlOrderRepository();

    void place(Order order) {
        repo.save(order);
    }
}`,
          },
          {
            type: "code",
            lang: "java",
            caption: "After: the service depends on an interface it owns.",
            code: `interface OrderRepository {
    void save(Order order);
}

class OrderService {
    private final OrderRepository repo;

    OrderService(OrderRepository repo) {
        this.repo = repo;
    }

    void place(Order order) {
        repo.save(order);
    }
}`,
          },
          {
            type: "p",
            text: "**In interviews:** inject repositories, clocks and notifiers through constructors. It makes your design testable and shows you think beyond the happy path.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Not definitions, but application. Name the principle when you make a decision ('splitting this out for SRP', 'this interface keeps us closed for modification'). Also avoid over-applying SOLID: five interfaces for a class that will never vary is a smell too. Abstract where change is likely.",
          },
        ],
      },
    ],
  },

  // 3. Design patterns
  {
    slug: "design-patterns-for-interviews",
    title: "Design Patterns That Matter in LLD Rounds",
    level: "intermediate",
    summary:
      "The ten design patterns that come up most in LLD interviews, with a reference table and working Java for Strategy, Observer and State.",
    tags: ["design-patterns", "java", "lld"],
    sections: [
      {
        id: "why-patterns",
        heading: "Patterns as shared vocabulary",
        blocks: [
          {
            type: "p",
            text: "Design patterns are named solutions to recurring design problems. In an interview they save time: saying 'the pricing logic is a Strategy' instantly communicates an interface, several implementations and a context that holds one. The goal is not to fit as many patterns as possible into a design, but to recognise the problem shape and reach for the right one.",
          },
          {
            type: "list",
            items: [
              "**Creational** patterns control how objects are built (Singleton, Factory, Builder).",
              "**Structural** patterns control how objects are composed (Decorator, Adapter).",
              "**Behavioural** patterns control how objects interact and divide work (Strategy, Observer, State, Command, Chain of Responsibility).",
            ],
          },
        ],
      },
      {
        id: "pattern-reference",
        heading: "The ten patterns to know",
        blocks: [
          {
            type: "table",
            head: ["Pattern", "Category", "Problem it solves", "Interview example"],
            rows: [
              ["Singleton", "Creational", "Exactly one shared instance with global access", "`ParkingLot` instance, ID generator, config registry"],
              ["Factory", "Creational", "Create the right subtype without callers knowing the class", "`VehicleFactory.create(type)`, spot or piece creation"],
              ["Builder", "Creational", "Construct objects with many optional fields readably", "`Pizza`, `HttpRequest`, search query with filters"],
              ["Strategy", "Behavioural", "Swap an algorithm at runtime behind one interface", "Fee models, spot allocation, rate limiting algorithm"],
              ["Observer", "Behavioural", "Notify many dependents when one object changes", "Order status updates, stock price alerts, display boards"],
              ["State", "Behavioural", "Behaviour changes with internal state, avoid giant switches", "Vending machine, elevator, order lifecycle"],
              ["Decorator", "Structural", "Add responsibilities by wrapping, without subclass explosion", "Toppings on coffee, logging or caching around a service"],
              ["Adapter", "Structural", "Make an incompatible interface fit the one you expect", "Wrapping a third-party payment SDK"],
              ["Command", "Behavioural", "Turn a request into an object to queue, log or undo", "Text editor undo, remote control, task scheduler"],
              ["Chain of Responsibility", "Behavioural", "Pass a request along handlers until one handles it", "ATM note dispensing, request filters, approval workflows"],
            ],
          },
          {
            type: "callout",
            tone: "warning",
            title: "Singleton caveats",
            text: "Singletons are global state and make testing harder. If you use one, mention thread-safe initialisation (an enum singleton or the holder-class idiom) and that injecting a single instance through constructors is often cleaner.",
          },
        ],
      },
      {
        id: "strategy",
        heading: "Strategy: interchangeable algorithms",
        blocks: [
          {
            type: "p",
            text: "Use Strategy when the same operation has several algorithms and you want to pick one at runtime or add more later. The context holds a reference to the strategy interface and delegates to it. This is the single most useful pattern in LLD rounds because almost every problem has a policy that the interviewer will ask you to change.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Fare calculation for a ride app, swappable without touching Trip.",
            code: `interface FareStrategy {
    long fareCents(double km, int minutes);
}

class StandardFare implements FareStrategy {
    public long fareCents(double km, int minutes) {
        return 5000 + Math.round(km * 1200) + minutes * 100L;
    }
}

class SurgeFare implements FareStrategy {
    private final FareStrategy base;
    private final double multiplier;

    SurgeFare(FareStrategy base, double multiplier) {
        this.base = base;
        this.multiplier = multiplier;
    }

    public long fareCents(double km, int minutes) {
        return Math.round(base.fareCents(km, minutes) * multiplier);
    }
}

class Trip {
    private final double km;
    private final int minutes;
    private FareStrategy fareStrategy;

    Trip(double km, int minutes, FareStrategy fareStrategy) {
        this.km = km;
        this.minutes = minutes;
        this.fareStrategy = fareStrategy;
    }

    void setFareStrategy(FareStrategy strategy) { this.fareStrategy = strategy; }

    long totalFare() { return fareStrategy.fareCents(km, minutes); }
}`,
          },
          {
            type: "p",
            text: "`SurgeFare` wrapping another strategy is a small taste of Decorator: the two patterns combine naturally.",
          },
        ],
      },
      {
        id: "observer",
        heading: "Observer: publish changes to subscribers",
        blocks: [
          {
            type: "p",
            text: "Use Observer when one object (the subject) changes and an open-ended set of other objects need to react. The subject keeps a list of listeners behind an interface and calls them on each event, so adding a new reaction never changes the subject.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Order status changes fan out to independent listeners.",
            code: `import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

enum OrderStatus { PLACED, SHIPPED, DELIVERED }

interface OrderListener {
    void onStatusChange(String orderId, OrderStatus status);
}

class Order {
    private final String id;
    private OrderStatus status = OrderStatus.PLACED;
    // Copy-on-write lets listeners be added while a notification loop is running.
    private final List<OrderListener> listeners = new CopyOnWriteArrayList<>();

    Order(String id) { this.id = id; }

    void subscribe(OrderListener l) { listeners.add(l); }
    void unsubscribe(OrderListener l) { listeners.remove(l); }

    void updateStatus(OrderStatus next) {
        this.status = next;
        for (OrderListener l : listeners) {
            l.onStatusChange(id, next);
        }
    }
}

class SmsListener implements OrderListener {
    public void onStatusChange(String orderId, OrderStatus status) {
        System.out.println("SMS: order " + orderId + " is " + status);
    }
}

class AnalyticsListener implements OrderListener {
    public void onStatusChange(String orderId, OrderStatus status) {
        System.out.println("Track event " + status + " for " + orderId);
    }
}`,
          },
        ],
      },
      {
        id: "state",
        heading: "State: behaviour that depends on the current state",
        blocks: [
          {
            type: "p",
            text: "Use State when an object responds differently to the same request depending on its state, and the transitions are well defined. Each state becomes a class that implements the same interface, and the context delegates to its current state object. This replaces long `switch (state)` blocks repeated in every method.",
          },
          {
            type: "code",
            lang: "java",
            caption: "A simplified vending machine where each state decides what is legal.",
            code: `interface VendingState {
    void insertCoin(VendingMachine m, int amount);
    void selectItem(VendingMachine m, String code);
}

class IdleState implements VendingState {
    public void insertCoin(VendingMachine m, int amount) {
        m.addCredit(amount);
        m.setState(new HasCreditState());
    }
    public void selectItem(VendingMachine m, String code) {
        System.out.println("Insert money first");
    }
}

class HasCreditState implements VendingState {
    public void insertCoin(VendingMachine m, int amount) {
        m.addCredit(amount);
    }
    public void selectItem(VendingMachine m, String code) {
        int price = m.priceOf(code);
        if (m.getCredit() < price) {
            System.out.println("Not enough credit");
            return;
        }
        m.dispense(code, price);
        m.setState(new IdleState());
    }
}

class VendingMachine {
    private VendingState state = new IdleState();
    private int credit;

    void insertCoin(int amount) { state.insertCoin(this, amount); }
    void selectItem(String code) { state.selectItem(this, code); }

    void setState(VendingState s) { this.state = s; }
    void addCredit(int amount) { credit += amount; }
    int getCredit() { return credit; }
    int priceOf(String code) { return 25; }

    void dispense(String code, int price) {
        credit -= price;
        System.out.println("Dispensed " + code + ", change " + credit);
        credit = 0;
    }
}`,
          },
          {
            type: "tradeoff",
            question: "State pattern or an enum with a switch?",
            a: "Enum plus switch: compact and fine for three or four states with little behaviour each.",
            b: "State classes: each state's rules live together, adding a state does not touch others, transitions are explicit.",
            verdict: "Start with an enum if the machine is tiny, but move to State classes once several methods would each need a switch. Interviewers usually expect the class version for vending machines and elevators.",
          },
        ],
      },
      {
        id: "choosing-patterns",
        heading: "Choosing the right pattern under time pressure",
        blocks: [
          {
            type: "list",
            items: [
              "Hear 'different ways to calculate, allocate or price'? Reach for **Strategy**.",
              "Hear 'notify', 'subscribe' or 'display board updates'? Reach for **Observer**.",
              "Hear 'the machine behaves differently when idle, running or out of stock'? Reach for **State**.",
              "Hear 'many optional parameters'? Use a **Builder**. Hear 'create based on type'? Use a **Factory**.",
              "Hear 'undo' or 'queue of operations'? Use **Command**. Hear 'pass to the next handler'? Use **Chain of Responsibility**.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Patterns used to solve a stated requirement, not sprinkled for decoration. Name the pattern, say what problem it removes, and show where the extension point is. Being able to explain why you did not use a pattern (for example, no Singleton because the lot is injected) is just as strong a signal.",
          },
        ],
      },
    ],
  },

  // 4. LLD interview approach
  {
    slug: "lld-interview-approach",
    title: "How to Run an LLD Interview",
    level: "basic",
    summary:
      "A step by step playbook for a 45 to 60 minute low-level design round, plus the UML class diagram notation you need to draw it.",
    tags: ["interview", "uml", "lld"],
    sections: [
      {
        id: "time-plan",
        heading: "A time plan for the round",
        blocks: [
          {
            type: "p",
            text: "LLD rounds are open ended, and the most common failure is not a bad design but running out of time with half a design. Treat the round as a sequence of checkpoints, and say each transition out loud so the interviewer can redirect you early.",
          },
          {
            type: "table",
            head: ["Phase", "Time (60 min round)", "Output"],
            rows: [
              ["Clarify requirements", "5 to 8 min", "A short list of in-scope features and explicit non-goals"],
              ["Identify entities", "5 min", "Nouns turned into candidate classes and enums"],
              ["Relationships and class diagram", "10 min", "Boxes, arrows and multiplicities"],
              ["Define APIs", "5 min", "Public methods of the key classes"],
              ["Implement core code", "15 to 20 min", "The classes that carry the main logic"],
              ["Concurrency and extensibility", "5 to 8 min", "Locks or atomic structures, extension points"],
              ["Walk through a use case", "3 to 5 min", "Trace one request end to end"],
            ],
          },
        ],
      },
      {
        id: "step-by-step",
        heading: "The steps in detail",
        blocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "**Clarify requirements.** Ask who the actors are, which operations matter, and what is out of scope. 'Do we need payments, or only entry and exit?' Write the agreed list down where the interviewer can see it.",
              "**Identify entities.** Pull nouns from the requirements: `ParkingLot`, `Floor`, `Spot`, `Ticket`, `Vehicle`. Turn fixed sets into enums (`SpotType`, `VehicleType`). Drop nouns that are just attributes.",
              "**Define relationships.** For each pair ask: does one own the other (composition), merely hold a reference (association or aggregation), or is it a kind of the other (inheritance)? Add multiplicities.",
              "**Draw the class diagram.** Keep it to the core 6 to 12 classes. Show key fields and methods only, not every getter.",
              "**Define APIs.** Write the public method signatures of the entry-point class, such as `Ticket park(Vehicle v)` and `Receipt unpark(String ticketId)`. Decide what each returns and which exceptions it throws.",
              "**Handle concurrency and extensibility.** Identify shared mutable state (available spots, seat inventory, cache maps) and decide how it is protected. Point to the interfaces that let new types plug in.",
              "**Walk through a use case.** Narrate one call from the entry point down through the objects. This often catches a missing link in your diagram.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            title: "Write the code that matters",
            text: "You will not have time to write every class. Prioritise the class with the most interesting logic (the allocator, the win checker, the cache eviction) and stub the rest with signatures.",
          },
        ],
      },
      {
        id: "uml-notation",
        heading: "UML class diagram notation",
        blocks: [
          {
            type: "p",
            text: "You do not need full UML, but you do need to draw the six relationship types correctly and explain the difference between aggregation and composition, which interviewers love to ask about.",
          },
          {
            type: "table",
            head: ["Relationship", "Meaning", "Mermaid arrow", "Java shape"],
            rows: [
              ["Inheritance", "B is a kind of A", "`A <|-- B`", "`class B extends A`"],
              ["Realization", "B implements interface A", "`A <|.. B`", "`class B implements A`"],
              ["Composition", "A owns B, B dies with A", "`A *-- B`", "A creates B internally, B never shared"],
              ["Aggregation", "A has B, B can live on its own", "`A o-- B`", "B passed in, may be shared"],
              ["Association", "A holds a long-lived reference to B", "`A --> B`", "A field of type B"],
              ["Dependency", "A uses B briefly", "`A ..> B`", "B is a parameter or local variable"],
            ],
          },
          {
            type: "p",
            text: "Visibility markers prefix members: `+` public, `-` private, `#` protected, `~` package-private. Multiplicity goes at each end of a line: `1`, `0..1`, `*` (many) or `1..*` (at least one).",
          },
          {
            type: "diagram",
            caption: "A small library model showing every relationship type.",
            chart: `classDiagram
  class User {
    -String userId
    -String name
  }
  class Member {
    -int maxLoans
    +borrow(BookCopy copy) Loan
  }
  class Library {
    -String name
    +addCopy(BookCopy copy) void
  }
  class BookCopy {
    -String barcode
    +isAvailable() boolean
  }
  class Shelf {
    -String label
  }
  class Loan {
    -LocalDate dueDate
    +close() void
  }
  class Notifier {
    <<interface>>
    +send(String userId, String text) void
  }
  class EmailNotifier {
    +send(String userId, String text) void
  }
  User <|-- Member
  Notifier <|.. EmailNotifier
  Library "1" *-- "1..*" Shelf : owns
  Shelf "1" o-- "*" BookCopy : holds
  Member "1" --> "*" Loan : has
  Loan "*" --> "1" BookCopy : for
  Loan ..> Notifier : reminds via`,
          },
          {
            type: "p",
            text: "Here a `Shelf` cannot exist without its `Library`, so it is composition. A `BookCopy` can move between shelves, so it is aggregation. A `Loan` only uses the `Notifier` when sending a reminder, so it is a dependency.",
          },
        ],
      },
      {
        id: "apis-and-concurrency",
        heading: "APIs, concurrency and extensibility",
        blocks: [
          {
            type: "p",
            text: "Once the diagram is agreed, expose the system through one facade-style entry point. This keeps the walk-through simple and gives you a natural place to validate input.",
          },
          {
            type: "code",
            lang: "java",
            caption: "A minimal entry point for a parking lot, with the shared state protected.",
            code: `import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ParkingService {
    private final SpotAllocator allocator;
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();

    public ParkingService(SpotAllocator allocator) {
        this.allocator = allocator;
    }

    public Ticket park(Vehicle vehicle) {
        // The allocator reserves a spot atomically, so two cars never get the same one.
        Spot spot = allocator.reserve(vehicle.getType())
                .orElseThrow(() -> new IllegalStateException("lot full"));
        Ticket ticket = new Ticket(vehicle, spot);
        activeTickets.put(ticket.getId(), ticket);
        return ticket;
    }

    public void unpark(String ticketId) {
        Ticket ticket = activeTickets.remove(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("unknown ticket " + ticketId);
        }
        allocator.release(ticket.getSpot());
    }
}`,
          },
          {
            type: "list",
            items: [
              "**Find shared mutable state** and decide: `synchronized` method, `ReentrantLock`, a concurrent collection, or an atomic compare-and-set.",
              "**Keep critical sections small.** Lock only the check-then-act on the scarce resource, not the whole request.",
              "**Name the extension points.** 'A new spot allocation policy is a new `SpotAllocator` implementation.'",
            ],
          },
        ],
      },
      {
        id: "walkthrough-and-pitfalls",
        heading: "Walk-through and common pitfalls",
        blocks: [
          {
            type: "p",
            text: "End by tracing a real scenario: 'A car arrives, `park` asks the allocator for a compact spot, the allocator removes it from the free list under a lock, a ticket is issued and stored.' Then trace the exit. If the interviewer asks a what-if, show which class changes and which stay untouched.",
          },
          {
            type: "list",
            items: [
              "Jumping into code before agreeing on requirements.",
              "Modelling every noun as a class, including plain attributes like colour or name.",
              "Putting all logic into one manager class (an SRP violation the interviewer will probe).",
              "Ignoring concurrency until asked, or locking the whole system with one global lock without comment.",
              "Using inheritance where a type field or a strategy would be simpler.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Structured communication, a correct and readable class diagram, clean separation of responsibilities, working core logic, and awareness of thread safety and extension points. A design that is 80 percent complete and well explained beats a perfect design you never finish describing.",
          },
        ],
      },
    ],
  },

  // 5. Tic-tac-toe
  {
    slug: "design-tic-tac-toe",
    title: "Design Tic-Tac-Toe",
    level: "basic",
    summary:
      "A complete object-oriented design of an N by N tic-tac-toe game with O(1) win detection, clear game states and room to extend.",
    tags: ["lld", "game", "java"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "Tic-tac-toe looks trivial, which is exactly why interviewers use it: they want to see clean modelling, validation and an efficient win check, not a 3 by 3 hard-coded mess. Start by agreeing on scope.",
          },
          {
            type: "list",
            items: [
              "Two players take turns placing their mark (X or O) on an empty cell.",
              "The board is N by N (default 3), and a player wins with N marks in a row, column or either diagonal.",
              "The game ends in a win or a draw when the board is full.",
              "Invalid moves (out of bounds, occupied cell, wrong player, game over) are rejected with a clear error.",
              "Out of scope for now: networking, AI opponents, persistence. We will discuss how to add them.",
            ],
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "list",
            items: [
              "`Mark`: enum of X and O.",
              "`Player`: a name and the mark they play.",
              "`Board`: owns the grid, validates placement and reports whether it is full.",
              "`WinChecker`: decides whether the latest move wins. Tracking running counts per row, column and diagonal gives O(1) per move instead of scanning the board.",
              "`Game`: the entry point. Holds players, whose turn it is, and the `GameStatus`.",
              "`GameStatus`: enum of IN_PROGRESS, X_WON, O_WON, DRAW.",
            ],
          },
          {
            type: "diagram",
            caption: "Game composes the board and the win checker, and aggregates two players.",
            chart: `classDiagram
  class Mark {
    <<enumeration>>
    X
    O
  }
  class GameStatus {
    <<enumeration>>
    IN_PROGRESS
    X_WON
    O_WON
    DRAW
  }
  class Player {
    -String name
    -Mark mark
  }
  class Board {
    -Mark[][] grid
    -int size
    -int filled
    +place(int row, int col, Mark mark) void
    +isFull() boolean
  }
  class WinChecker {
    -int[] rows
    -int[] cols
    -int diagonal
    -int antiDiagonal
    +recordAndCheck(int row, int col, Mark mark) boolean
  }
  class Game {
    -Player[] players
    -int turn
    -GameStatus status
    +makeMove(Player player, int row, int col) GameStatus
  }
  Game "1" *-- "1" Board
  Game "1" *-- "1" WinChecker
  Game "1" o-- "2" Player
  Player --> Mark
  Board ..> Mark
  Game --> GameStatus`,
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow",
        blocks: [
          {
            type: "p",
            text: "A move flows through validation, placement, win detection and the turn switch. Only `Game` mutates the status, which keeps the rules in one place.",
          },
          {
            type: "diagram",
            caption: "One successful move that does not end the game.",
            chart: `sequenceDiagram
  participant C as Client
  participant G as Game
  participant B as Board
  participant W as WinChecker
  C->>G: makeMove(alice, 1, 2)
  G->>G: validate status and turn
  G->>B: place(1, 2, X)
  B-->>G: ok
  G->>W: recordAndCheck(1, 2, X)
  W-->>G: false
  G->>B: isFull()
  B-->>G: false
  G->>G: switch turn to bob
  G-->>C: IN_PROGRESS`,
          },
        ],
      },
      {
        id: "implementation",
        heading: "Implementation",
        blocks: [
          {
            type: "p",
            text: "The win checker adds +1 for X and -1 for O to the counters of the row, column and diagonals touched by a move. A counter reaching +N or -N means that line is complete for one player.",
          },
          {
            type: "code",
            lang: "java",
            caption: "Core classes for an N by N game.",
            code: `enum Mark { X, O }

enum GameStatus { IN_PROGRESS, X_WON, O_WON, DRAW }

final class Player {
    private final String name;
    private final Mark mark;

    Player(String name, Mark mark) {
        this.name = name;
        this.mark = mark;
    }

    String getName() { return name; }
    Mark getMark() { return mark; }
}

final class Board {
    private final Mark[][] grid;
    private final int size;
    private int filled;

    Board(int size) {
        this.size = size;
        this.grid = new Mark[size][size];
    }

    int getSize() { return size; }

    void place(int row, int col, Mark mark) {
        if (row < 0 || col < 0 || row >= size || col >= size) {
            throw new IllegalArgumentException("cell out of bounds");
        }
        if (grid[row][col] != null) {
            throw new IllegalStateException("cell already taken");
        }
        grid[row][col] = mark;
        filled++;
    }

    boolean isFull() { return filled == size * size; }
}

final class WinChecker {
    private final int n;
    private final int[] rows;
    private final int[] cols;
    private int diagonal;
    private int antiDiagonal;

    WinChecker(int n) {
        this.n = n;
        this.rows = new int[n];
        this.cols = new int[n];
    }

    boolean recordAndCheck(int row, int col, Mark mark) {
        int delta = mark == Mark.X ? 1 : -1;
        rows[row] += delta;
        cols[col] += delta;
        if (row == col) diagonal += delta;
        if (row + col == n - 1) antiDiagonal += delta;
        return Math.abs(rows[row]) == n
                || Math.abs(cols[col]) == n
                || Math.abs(diagonal) == n
                || Math.abs(antiDiagonal) == n;
    }
}

public class Game {
    private final Board board;
    private final WinChecker winChecker;
    private final Player[] players;
    private int turn;
    private GameStatus status = GameStatus.IN_PROGRESS;

    public Game(Player first, Player second, int size) {
        if (first.getMark() == second.getMark()) {
            throw new IllegalArgumentException("players need different marks");
        }
        this.board = new Board(size);
        this.winChecker = new WinChecker(size);
        this.players = new Player[] { first, second };
    }

    public synchronized GameStatus makeMove(Player player, int row, int col) {
        if (status != GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("game is over: " + status);
        }
        if (player != players[turn]) {
            throw new IllegalStateException("not " + player.getName() + "'s turn");
        }
        board.place(row, col, player.getMark());

        if (winChecker.recordAndCheck(row, col, player.getMark())) {
            status = player.getMark() == Mark.X ? GameStatus.X_WON : GameStatus.O_WON;
        } else if (board.isFull()) {
            status = GameStatus.DRAW;
        } else {
            turn = 1 - turn;
        }
        return status;
    }

    public synchronized GameStatus getStatus() { return status; }

    public synchronized Player currentPlayer() { return players[turn]; }
}`,
          },
          {
            type: "p",
            text: "`Board.place` validates before mutating, so a rejected move leaves the board, the counters and the turn untouched. The win check runs in O(1) time with O(N) extra memory instead of O(N) per move scanning lines.",
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "table",
            head: ["New requirement", "What changes"],
            rows: [
              ["Bigger board or K-in-a-row (Gomoku style)", "Replace `WinChecker` with an interface and add a `KInARowChecker` that scans outward from the last move (O(K))."],
              ["More than two players", "Make `players` a `List<Player>`, turn becomes `(turn + 1) % size`, and the counter trick gives way to per-mark checks."],
              ["Computer opponent", "Introduce a `MoveStrategy` interface (human input, random, minimax). `Game` stays unchanged."],
              ["Undo", "Record each move as a `Move` command object on a stack. Undo reverses the board cell and the counters."],
              ["Spectators or UI updates", "Add Observer: `Game` publishes `onMove` and `onGameOver` events to listeners."],
            ],
          },
          {
            type: "p",
            text: "**Concurrency:** a local game is single-threaded, but if two network clients can call `makeMove` at the same time, the check-then-act on turn and cell must be atomic. Synchronising `makeMove` on the game instance is enough because each game is independent, so contention is tiny. A server hosting many games keeps them in a `ConcurrentHashMap<String, Game>` and each game guards itself.",
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A board that is not hard-coded to 3 by 3, validation that rejects bad moves without corrupting state, an O(1) or O(N) win check rather than a full rescan, a clear status enum instead of scattered booleans, and a confident answer to 'how would you add an AI player or undo?' (Strategy and Command).",
          },
        ],
      },
    ],
  },

  // 6. LRU cache
  {
    slug: "design-lru-cache",
    title: "Design an LRU Cache",
    level: "intermediate",
    summary:
      "A generic LRU cache with O(1) get and put using a hash map and doubly linked list, plus thread-safety options and the LinkedHashMap shortcut.",
    tags: ["lld", "cache", "data-structures", "concurrency"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "An LRU (least recently used) cache holds a fixed number of entries. When it is full and a new key arrives, it evicts the entry that was accessed longest ago. This question tests data structure choice, pointer manipulation and how you reason about concurrency on a structure where even reads mutate state.",
          },
          {
            type: "list",
            items: [
              "`get(key)` returns the value or empty if absent, and marks the key as most recently used.",
              "`put(key, value)` inserts or updates and marks the key as most recently used.",
              "When size exceeds capacity, evict the least recently used entry.",
              "Both operations must run in O(1) average time.",
              "Generic over key and value types. Capacity fixed at construction and must be positive.",
              "Discuss: thread safety, eviction listeners, swapping the eviction policy.",
            ],
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "p",
            text: "A hash map alone gives O(1) lookup but no ordering. A linked list gives ordering but O(N) lookup. Combining them gives both: the map points directly at list nodes, and the list order is the recency order (head is most recent, tail is least recent). The list must be **doubly** linked so a node can unlink itself in O(1) without searching for its predecessor.",
          },
          {
            type: "diagram",
            caption: "The cache composes a map and a list that share the same Node objects.",
            chart: `classDiagram
  class Cache {
    <<interface>>
    +get(K key) Optional
    +put(K key, V value) void
    +size() int
  }
  class LRUCache {
    -int capacity
    -Map index
    -DoublyLinkedList list
    +get(K key) Optional
    +put(K key, V value) void
    +size() int
  }
  class DoublyLinkedList {
    -Node head
    -Node tail
    +addFirst(Node node) void
    +remove(Node node) void
    +removeLast() Node
  }
  class Node {
    -K key
    -V value
    -Node prev
    -Node next
  }
  Cache <|.. LRUCache
  LRUCache "1" *-- "1" DoublyLinkedList
  DoublyLinkedList "1" o-- "*" Node
  LRUCache ..> Node`,
          },
          {
            type: "p",
            text: "Sentinel `head` and `tail` nodes remove all null checks at the ends of the list, which is the main source of bugs when this is coded on a whiteboard. The node stores its key so that eviction from the tail can also remove the map entry.",
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow",
        blocks: [
          {
            type: "diagram",
            caption: "A put that triggers eviction, followed by a get hit.",
            chart: `sequenceDiagram
  participant C as Client
  participant L as LRUCache
  participant M as HashMap
  participant D as DoublyLinkedList
  C->>L: put(k4, v4)
  L->>M: get(k4)
  M-->>L: null
  L->>D: addFirst(node k4)
  L->>M: put(k4, node)
  L->>D: removeLast()
  D-->>L: node k1
  L->>M: remove(k1)
  L-->>C: done
  C->>L: get(k2)
  L->>M: get(k2)
  M-->>L: node k2
  L->>D: remove(node k2)
  L->>D: addFirst(node k2)
  L-->>C: Optional of v2`,
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
            caption: "Generic LRU cache, coarse-grained thread safety via synchronized.",
            code: `import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

interface Cache<K, V> {
    Optional<V> get(K key);
    void put(K key, V value);
    int size();
}

final class Node<K, V> {
    final K key;
    V value;
    Node<K, V> prev;
    Node<K, V> next;

    Node(K key, V value) {
        this.key = key;
        this.value = value;
    }
}

final class DoublyLinkedList<K, V> {
    // Sentinels: real nodes always sit between head and tail.
    private final Node<K, V> head = new Node<>(null, null);
    private final Node<K, V> tail = new Node<>(null, null);

    DoublyLinkedList() {
        head.next = tail;
        tail.prev = head;
    }

    void addFirst(Node<K, V> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    void remove(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = null;
        node.next = null;
    }

    void moveToFront(Node<K, V> node) {
        remove(node);
        addFirst(node);
    }

    Node<K, V> removeLast() {
        if (tail.prev == head) {
            return null;
        }
        Node<K, V> last = tail.prev;
        remove(last);
        return last;
    }
}

public class LRUCache<K, V> implements Cache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> index;
    private final DoublyLinkedList<K, V> list = new DoublyLinkedList<>();

    public LRUCache(int capacity) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("capacity must be positive");
        }
        this.capacity = capacity;
        this.index = new HashMap<>(capacity * 2);
    }

    @Override
    public synchronized Optional<V> get(K key) {
        Node<K, V> node = index.get(key);
        if (node == null) {
            return Optional.empty();
        }
        list.moveToFront(node);
        return Optional.ofNullable(node.value);
    }

    @Override
    public synchronized void put(K key, V value) {
        Node<K, V> existing = index.get(key);
        if (existing != null) {
            existing.value = value;
            list.moveToFront(existing);
            return;
        }
        Node<K, V> node = new Node<>(key, value);
        list.addFirst(node);
        index.put(key, node);
        if (index.size() > capacity) {
            Node<K, V> evicted = list.removeLast();
            index.remove(evicted.key);
        }
    }

    @Override
    public synchronized int size() {
        return index.size();
    }
}`,
          },
          {
            type: "p",
            text: "The shortcut, worth mentioning once you have shown you can build it by hand: `LinkedHashMap` with `accessOrder = true` keeps entries in access order, and overriding `removeEldestEntry` gives eviction for free.",
          },
          {
            type: "code",
            lang: "java",
            caption: "LinkedHashMap does the bookkeeping, but it is not thread-safe on its own.",
            code: `import java.util.LinkedHashMap;
import java.util.Map;

class SimpleLru<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    SimpleLru(int capacity) {
        super(16, 0.75f, true);
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}`,
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "p",
            text: "The key insight for concurrency: in an LRU cache **every `get` is a write**, because it moves a node to the front. That rules out the naive idea of letting reads share a lock.",
          },
          {
            type: "table",
            head: ["Option", "How it works", "Trade-off"],
            rows: [
              ["`synchronized` methods", "One monitor guards map and list together", "Simple and correct. All operations serialise, fine for moderate load."],
              ["`ReentrantReadWriteLock`", "Readers share, writers exclusive", "Little gain for LRU since `get` reorders the list and needs the write lock. Only useful if you accept approximate recency, for example recording accesses in a buffer and applying them later."],
              ["Segmented (lock striping)", "N independent LRU caches, key hash picks a segment, each with its own lock", "Much higher throughput. Eviction becomes per-segment, so recency is approximate across the whole cache."],
              ["`Collections.synchronizedMap(new SimpleLru<>(n))`", "Wraps the LinkedHashMap shortcut in a single lock", "Quickest correct answer in code, same scalability as `synchronized`."],
              ["Production library", "Caffeine or Guava cache", "Concurrent, near-LRU policies, expiry and stats. Say you would use one in real code."],
            ],
          },
          {
            type: "list",
            items: [
              "**Different eviction policy (LFU, FIFO):** extract an `EvictionPolicy<K>` interface with `onAccess`, `onInsert` and `evict`, and let the cache delegate to it (Strategy).",
              "**Eviction listener:** accept a `BiConsumer<K, V>` or `EvictionListener` and call it after removal, outside the lock if it may be slow.",
              "**TTL expiry:** store an expiry timestamp in each node, treat expired nodes as misses on `get`, and optionally sweep with a scheduled task.",
              "**Null values:** decide explicitly. The code above allows them and uses `Optional.ofNullable`, but many caches reject nulls to avoid ambiguity.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "Correct reasoning for why a doubly linked list plus hash map gives O(1), sentinel nodes to avoid edge-case bugs, the node storing its key for eviction, generics, and a crisp concurrency answer: get mutates order, so a single lock or segmentation, not a read-write lock. Mentioning LinkedHashMap is a plus once the hand-built version is done.",
          },
        ],
      },
    ],
  },

  // 7. Rate limiter LLD
  {
    slug: "design-rate-limiter-lld",
    title: "Design a Rate Limiter (LLD)",
    level: "intermediate",
    summary:
      "An object-oriented, pluggable rate limiter with token bucket and sliding window strategies, a per-client registry and thread-safe state.",
    tags: ["lld", "rate-limiting", "concurrency", "strategy"],
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            type: "p",
            text: "In an HLD round a rate limiter is about Redis and gateways. In an LLD round the interviewer wants the object design inside one service: how algorithms plug in, how per-client state is stored and how it stays correct under concurrent requests.",
          },
          {
            type: "list",
            items: [
              "Decide per request whether a client (user ID, API key or IP) is allowed: `boolean tryAcquire(String clientId)`.",
              "Support at least two algorithms: **token bucket** (allows bursts up to capacity, refills at a steady rate) and **sliding window log** (at most N requests in any rolling window).",
              "Different client tiers can have different limits and algorithms.",
              "Thread-safe: many request threads hit the limiter for the same and different clients concurrently.",
              "Testable: time should be injectable, not read from `System.currentTimeMillis()` directly.",
              "Out of scope: distributed limiting across servers (discussed in extensibility).",
            ],
          },
        ],
      },
      {
        id: "entities-and-relationships",
        heading: "Entities and relationships",
        blocks: [
          {
            type: "list",
            items: [
              "`RateLimiter`: the Strategy interface. One instance holds the state for one client.",
              "`TokenBucketLimiter` and `SlidingWindowLogLimiter`: concrete algorithms.",
              "`LimitConfig`: immutable description of a policy (algorithm, capacity, window or refill rate).",
              "`RateLimiterFactory`: builds the right limiter from a config.",
              "`RateLimiterRegistry`: maps client IDs to their limiter, creating them lazily. This is the entry point.",
              "`TierResolver`: decides which `LimitConfig` applies to a client.",
              "`Clock`: abstraction over time so tests can control it.",
            ],
          },
          {
            type: "diagram",
            caption: "The registry owns one limiter per client and creates them through a factory.",
            chart: `classDiagram
  class RateLimiter {
    <<interface>>
    +tryAcquire() boolean
  }
  class TokenBucketLimiter {
    -long capacity
    -double refillPerMilli
    -double tokens
    -long lastRefillMillis
    +tryAcquire() boolean
  }
  class SlidingWindowLogLimiter {
    -int maxRequests
    -long windowMillis
    -Deque~Long~ timestamps
    +tryAcquire() boolean
  }
  class LimitConfig {
    -Algorithm algorithm
    -long limit
    -long windowMillis
  }
  class RateLimiterFactory {
    +create(LimitConfig config) RateLimiter
  }
  class RateLimiterRegistry {
    -Map limiters
    +tryAcquire(String clientId) boolean
  }
  class TierResolver {
    <<interface>>
    +configFor(String clientId) LimitConfig
  }
  class Clock {
    <<interface>>
    +nowMillis() long
  }
  RateLimiter <|.. TokenBucketLimiter
  RateLimiter <|.. SlidingWindowLogLimiter
  RateLimiterRegistry "1" *-- "*" RateLimiter
  RateLimiterRegistry --> RateLimiterFactory
  RateLimiterRegistry --> TierResolver
  RateLimiterFactory ..> LimitConfig
  TokenBucketLimiter --> Clock
  SlidingWindowLogLimiter --> Clock`,
          },
        ],
      },
      {
        id: "main-flow",
        heading: "Main flow",
        blocks: [
          {
            type: "diagram",
            caption: "First request from a client creates its limiter, later ones reuse it.",
            chart: `sequenceDiagram
  participant F as RequestFilter
  participant R as RateLimiterRegistry
  participant T as TierResolver
  participant Y as RateLimiterFactory
  participant L as TokenBucketLimiter
  F->>R: tryAcquire(client-42)
  R->>R: computeIfAbsent(client-42)
  R->>T: configFor(client-42)
  T-->>R: LimitConfig premium
  R->>Y: create(config)
  Y-->>R: new TokenBucketLimiter
  R->>L: tryAcquire()
  L->>L: refill tokens from elapsed time
  L-->>R: true
  R-->>F: true
  F->>F: forward request or return 429`,
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
            caption: "Strategy-based limiters with per-client state in a concurrent registry.",
            code: `import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

interface Clock {
    long nowMillis();
}

interface RateLimiter {
    boolean tryAcquire();
}

enum Algorithm { TOKEN_BUCKET, SLIDING_WINDOW_LOG }

final class LimitConfig {
    final Algorithm algorithm;
    final long limit;
    final long windowMillis;

    LimitConfig(Algorithm algorithm, long limit, long windowMillis) {
        if (limit <= 0 || windowMillis <= 0) {
            throw new IllegalArgumentException("limit and window must be positive");
        }
        this.algorithm = algorithm;
        this.limit = limit;
        this.windowMillis = windowMillis;
    }
}

final class TokenBucketLimiter implements RateLimiter {
    private final long capacity;
    private final double refillPerMilli;
    private final Clock clock;
    private double tokens;
    private long lastRefillMillis;

    TokenBucketLimiter(long capacity, long refillWindowMillis, Clock clock) {
        this.capacity = capacity;
        this.refillPerMilli = (double) capacity / refillWindowMillis;
        this.clock = clock;
        this.tokens = capacity;
        this.lastRefillMillis = clock.nowMillis();
    }

    @Override
    public synchronized boolean tryAcquire() {
        // Lazy refill: no background thread, tokens are topped up on each call.
        long now = clock.nowMillis();
        tokens = Math.min(capacity, tokens + (now - lastRefillMillis) * refillPerMilli);
        lastRefillMillis = now;
        if (tokens >= 1) {
            tokens -= 1;
            return true;
        }
        return false;
    }
}

final class SlidingWindowLogLimiter implements RateLimiter {
    private final long maxRequests;
    private final long windowMillis;
    private final Clock clock;
    private final Deque<Long> timestamps = new ArrayDeque<>();

    SlidingWindowLogLimiter(long maxRequests, long windowMillis, Clock clock) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    @Override
    public synchronized boolean tryAcquire() {
        long now = clock.nowMillis();
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() >= windowMillis) {
            timestamps.pollFirst();
        }
        if (timestamps.size() < maxRequests) {
            timestamps.addLast(now);
            return true;
        }
        return false;
    }
}

final class RateLimiterFactory {
    private final Clock clock;

    RateLimiterFactory(Clock clock) { this.clock = clock; }

    RateLimiter create(LimitConfig config) {
        switch (config.algorithm) {
            case TOKEN_BUCKET:
                return new TokenBucketLimiter(config.limit, config.windowMillis, clock);
            case SLIDING_WINDOW_LOG:
                return new SlidingWindowLogLimiter(config.limit, config.windowMillis, clock);
            default:
                throw new IllegalArgumentException("unknown algorithm " + config.algorithm);
        }
    }
}

interface TierResolver {
    LimitConfig configFor(String clientId);
}

public final class RateLimiterRegistry {
    private final ConcurrentMap<String, RateLimiter> limiters = new ConcurrentHashMap<>();
    private final RateLimiterFactory factory;
    private final TierResolver tierResolver;

    public RateLimiterRegistry(RateLimiterFactory factory, TierResolver tierResolver) {
        this.factory = factory;
        this.tierResolver = tierResolver;
    }

    public boolean tryAcquire(String clientId) {
        // computeIfAbsent is atomic per key, so concurrent first requests share one limiter.
        RateLimiter limiter = limiters.computeIfAbsent(
                clientId, id -> factory.create(tierResolver.configFor(id)));
        return limiter.tryAcquire();
    }
}`,
          },
          {
            type: "p",
            text: "Each limiter locks only itself, so clients never contend with each other. The registry relies on `ConcurrentHashMap.computeIfAbsent` to avoid two threads creating two different limiters for the same client, which would silently double the allowed rate.",
          },
        ],
      },
      {
        id: "extensibility-and-concurrency",
        heading: "Extensibility and concurrency",
        blocks: [
          {
            type: "table",
            head: ["New requirement", "What changes"],
            rows: [
              ["New algorithm (fixed window, sliding window counter, leaky bucket)", "New `RateLimiter` class plus one factory case. Registry and callers untouched."],
              ["Limit by user and by endpoint", "Key the registry by a composite such as `clientId + \":\" + route`, or chain two limiters with a `CompositeLimiter` that requires both to allow."],
              ["Memory growth from idle clients", "Track last access per entry and evict idle limiters with a scheduled sweep, or back the registry with an expiring cache such as Caffeine."],
              ["Changing a client's tier at runtime", "Remove the entry so the next request recreates it, or have limiters read a mutable config reference."],
              ["Distributed limiting", "Introduce a `RateLimiterStore` behind the strategy, implemented with Redis and an atomic Lua script or `INCR` plus expiry. The interface stays the same."],
            ],
          },
          {
            type: "list",
            items: [
              "**Why `synchronized` per limiter is enough:** the critical section is a few arithmetic operations, and contention only happens between requests from the same client.",
              "**Lock-free alternative:** a fixed-window counter can use `AtomicLong` with compare-and-set. Token bucket can pack tokens and timestamp into one `AtomicReference` of an immutable state object and retry on CAS failure.",
              "**Memory trade-off:** the sliding window log stores up to N timestamps per client. For large limits, a sliding window counter (two fixed buckets weighted by overlap) uses constant memory with a small accuracy loss.",
              "**Testing:** inject a fake `Clock` that tests advance manually, which makes refill and window boundaries deterministic.",
            ],
          },
          {
            type: "callout",
            tone: "interview",
            title: "What interviewers look for",
            text: "A `RateLimiter` interface with algorithms as Strategy implementations, a factory or config-driven creation, per-client state held in a `ConcurrentHashMap` created atomically, fine-grained locking per client rather than one global lock, an injected clock for testability, and a clear story for adding an algorithm or moving state to Redis without changing callers.",
          },
        ],
      },
    ],
  },
];
