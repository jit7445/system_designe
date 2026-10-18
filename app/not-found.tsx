import Link from "next/link";

export default function NotFound() {
  return (
    <main className="notfound">
      <span className="hero-badge">404</span>
      <h1>That page does not exist.</h1>
      <p>The link may be mistyped. Search with ⌘K, or start from the course introduction.</p>
      <Link href="/learn/introduction" className="btn btn-primary">
        Go to the introduction
      </Link>
    </main>
  );
}
