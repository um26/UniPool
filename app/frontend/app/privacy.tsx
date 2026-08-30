import React from "react";
import PolicyPage from "@/src/components/PolicyPage";

export default function PrivacyPage() {
  return <PolicyPage eyebrow="PRIVACY" title="Privacy Policy" intro="UniPool uses only the data needed to run university travel, chat, trust and money tools. We do not sell your personal information." sections={[
    { title: "Information you provide", body: "This can include your name, login email, university email and verification details, profile fields, ride information, messages, Circle expenses and settlements, personal money entries, reports, blocked/restricted users, pickup points and settings." },
    { title: "Information created by use", body: "UniPool may store session information, timestamps, presence/typing state, reliability and trip-history signals, notification state and privacy-safe product diagnostics needed to operate and debug the service." },
    { title: "How we use information", body: "We use data to authenticate users, verify university identity, match journeys, operate chats and Circles, calculate balances, send requested notifications, prevent abuse, investigate reports and improve product reliability." },
    { title: "Who can see what", body: "Other users see only the profile, ride, chat or Circle information needed for the feature they are using. Personal Money entries are private to you. Circle data is limited to Circle members. Reports are not shown to the reported user as a public profile item." },
    { title: "Service providers", body: "UniPool relies on infrastructure providers such as Vercel, Supabase, Render and other necessary technical services. These providers process data only to deliver the service. We may also use email/push providers for notifications when configured." },
    { title: "Retention and deletion", body: "We keep information while it is needed for active accounts, trip history, safety, accounting history or legal/operational requirements. Deleted or removed items may remain in backups or audit records for a limited period where necessary for integrity and abuse prevention." },
    { title: "Security", body: "We use authenticated APIs, access controls and row-level security for sensitive shared-state data. No internet service can guarantee absolute security, so users should avoid posting unnecessary sensitive information in chats or notes." },
    { title: "Your choices", body: "You can change notification preferences, block or restrict users, manage saved pickup points and contact BinaryBots about privacy questions or account-data requests. Where a feature supports deletion, removing an item affects future display while preserving necessary audit integrity." },
  ]} />;
}
