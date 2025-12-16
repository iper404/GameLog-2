export default async function Home() {
  const res = await fetch("http://127.0.0.1:8000/health", {
    cache: "no-store",
  });

  const data = await res.json();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">GameLog 2.0</h1>
      <p className="mt-4">Backend status:</p>
      <pre className="mt-2 bg-gray-100 p-2 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
