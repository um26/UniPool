import React from "react";
import PolicyPage from "@/src/components/PolicyPage";

export default function CommunityGuidelinesPage() {
  return <PolicyPage eyebrow="COMMUNITY" title="Community Guidelines" intro="UniPool works best when students can coordinate travel, money and conversations without spam, pressure or ambiguity." sections={[
    { title: "Be accurate", body: "Post genuine journeys, use realistic times and locations, and record shared expenses truthfully. Do not create fake rides, fake balances or misleading profiles." },
    { title: "Respect boundaries", body: "A ride request, chat or Circle invite is not permission to pressure someone. Respect declines, blocks and restrictions. Keep communication relevant to the journey or shared group context." },
    { title: "Keep coordination safe", body: "Use public, sensible pickup points where possible, confirm important details before travelling and avoid sharing unnecessary sensitive personal information." },
    { title: "No harassment or discrimination", body: "Threats, stalking, sexual harassment, targeted abuse, hateful conduct and attempts to bypass another user's safety controls are not allowed." },
    { title: "No fraud or financial manipulation", body: "Do not enter expenses you know are false, alter records to misrepresent debts, impersonate another payer or use Circles to pressure people into payments they did not agree to." },
    { title: "Use reporting responsibly", body: "Reports should describe real concerns. Deliberately false or retaliatory reports can themselves be treated as abuse." },
  ]} />;
}
