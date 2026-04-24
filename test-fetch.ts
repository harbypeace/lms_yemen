async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/xapi/public');
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}
test();
