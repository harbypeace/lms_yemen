import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/search/users?tenantId=123&role=student', {
      headers: {
        'Authorization': `Bearer fakeToken` // wait, it requires a valid session token?
      }
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}
test();
