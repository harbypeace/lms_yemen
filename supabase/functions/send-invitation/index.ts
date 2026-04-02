import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const { record } = await req.json()
  
  // Initialize Supabase client with service role key to bypass RLS
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Fetch tenant (school) name
  const { data: tenant } = await supabaseClient
    .from('tenants')
    .select('name')
    .eq('id', record.tenant_id)
    .single()

  const schoolName = tenant?.name || 'Nexus LMS School'
  const inviteLink = `${Deno.env.get('APP_URL')}/accept-invite?id=${record.id}`

  console.log(`Simulating email to ${record.email} for ${schoolName} as ${record.role}`)

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ message: 'Email simulated (RESEND_API_KEY missing)', inviteLink }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Nexus LMS <onboarding@resend.dev>',
      to: [record.email],
      subject: `Invitation to join ${schoolName}`,
      html: `
        <h1>Welcome to ${schoolName}!</h1>
        <p>You have been invited to join <strong>${schoolName}</strong> as a <strong>${record.role}</strong>.</p>
        <p>Click the link below to accept your invitation and get started:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; rounded: 8px;">Accept Invitation</a>
        <p>If you don't have an account, you'll be asked to create one first.</p>
      `,
    }),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
