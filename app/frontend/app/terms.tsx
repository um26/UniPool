import React from "react";
import PolicyPage from "@/src/components/PolicyPage";

export default function TermsPage() {
  return <PolicyPage eyebrow="LEGAL" title="Terms & Conditions" intro="These terms explain the rules for using UniPool's university mobility, chat and shared-money features. UniPool helps students coordinate; it is not a taxi operator, bank, wallet or payment processor." sections={[
    { title: "1. Eligibility and accounts", body: "Use UniPool only with accurate information and an account you are authorised to control. University verification and profile details must not be falsified. You are responsible for activity performed through your account and for keeping your login credentials secure." },
    { title: "2. Rides and meetups", body: "UniPool helps students discover and coordinate journeys. Drivers, passengers, cabs and other transport providers are independent from UniPool. Users remain responsible for checking timing, pickup points, fares, identity and personal safety before travelling." },
    { title: "3. Circles and money records", body: "Circles and Personal Money are record-keeping tools. UniPool does not hold, transfer or guarantee money. Users are responsible for entering expenses, splits, settlements and income accurately. Debt simplification changes only recommended settlement paths; it does not rewrite the underlying expense history." },
    { title: "4. Acceptable use", body: "Do not harass, threaten, impersonate, spam, defraud or misuse another person's data. Do not create fake rides, fake expenses, abusive messages or misleading reports. We may restrict or remove access when needed to protect users or the service." },
    { title: "5. User content", body: "You remain responsible for messages, ride notes, expense descriptions and other content you submit. You give UniPool permission to store and process that content only as needed to operate, secure and improve the service." },
    { title: "6. Safety and reports", body: "Blocking, restricting and reporting tools are provided to help users manage interactions. They do not replace emergency services. If there is an immediate safety risk, contact the appropriate local authority or emergency service." },
    { title: "7. Availability and changes", body: "Features may change as UniPool develops. We aim to keep the service available and accurate, but outages, third-party failures and data-sync delays can occur. Material changes to these terms will be reflected by a new version/date." },
    { title: "8. Liability", body: "To the extent permitted by applicable law, UniPool and BinaryBots are not responsible for losses caused by another user's conduct, transport providers, inaccurate user-entered expense records, or decisions made outside the service. Nothing here limits rights that cannot legally be waived." },
  ]} />;
}
