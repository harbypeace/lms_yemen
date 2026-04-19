import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okpruwomwojoshrbdewg.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("--- Nexus LMS Invitation Test ---");
  console.log("Resend Key:", resendKey ? "Configured" : "MISSING");
  
  const testEmail = 'lms_yemen@outlook.com';
  const schoolName = 'Owner Verification Academy';
  const slug = 'verify-academy-' + Math.floor(Math.random() * 1000);

  console.log(`Step 1: Creating pending school "${schoolName}"...`);
  const { data: tenant, error: tError } = await supabase.from('tenants').insert({
    name: schoolName,
    slug: slug,
    status: 'pending'
  }).select().single();
  
  if (tError) {
    console.error("Tenant Creation Error:", tError.message);
    return;
  }
  console.log(`Success: Tenant ID ${tenant.id}`);

  console.log(`Step 2: Creating invitation for ${testEmail}...`);
  const { data: invite, error: iError } = await supabase.from('invitations').insert({
    email: testEmail,
    role: 'school_admin',
    tenant_id: tenant.id
  }).select().single();
  
  if (iError) {
    console.error("Invitation Creation Error:", iError.message);
    return;
  }
  console.log(`Success: Invitation ID ${invite.id}`);

  const appUrl = process.env.APP_URL || 'https://ais-dev-5vxxeee2wtukhuzskj3ljn-403062711960.europe-west2.run.app';
  const inviteLink = `${appUrl}/accept-invite?id=${invite.id}`;
  console.log(`Invite Link: ${inviteLink}`);

  if (!resendKey) {
    console.log("\n[SIMULATION] No RESEND_API_KEY found. Email logged to console but not sent.");
    return;
  }

  console.log(`\nStep 3: Dispatching real email via Resend...`);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Nexus LMS <onboarding@resend.dev>',
        to: [testEmail],
        subject: `[Nexus LMS] Invitation to manage ${schoolName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h1 style="color: #4f46e5;">Invitation Test</h1>
            <p>You have been invited to manage <strong>${schoolName}</strong>.</p>
            <div style="margin: 32px 0;">
              <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #64748b; font-size: 12px;">This is a test to verify email delivery for ${testEmail}.</p>
          </div>
        `
      }),
    });

    const emailResult = await res.json();
    console.log("Resend API Full Response:", JSON.stringify(emailResult, null, 2));
    
    if (emailResult.id) {
      console.log("\n✅ SUCCESS: Email accepted by Resend API. Check your inbox/spam for " + testEmail);
    } else {
      console.log("\n❌ FAILED: Resend accepted the request but did not return a delivery ID.");
    }
  } catch (err) {
    console.error("\n❌ NETWORK ERROR:", err);
  }
}

run();
