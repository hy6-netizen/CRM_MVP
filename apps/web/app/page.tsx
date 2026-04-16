const links = [
  "/dashboard",
  "/reservations",
  "/conversations",
  "/reviews",
  "/templates",
  "/settings/integrations",
  "/settings/compliance",
  "/logs"
];

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Hospital Ops Hub MVP</h1>
      <p>운영 화면 바로가기</p>
      <ul>
        {links.map((href) => (
          <li key={href}>
            <a href={href}>{href}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
