import React from "react";
import PolicyPage from "@/src/components/PolicyPage";

export default function FaqPage() {
  return <PolicyPage eyebrow="HELP" title="Frequently Asked Questions" intro="Quick answers about rides, Circles, privacy, chats and student verification." sections={[
    { title: "Who can use UniPool?", body: "UniPool is designed for university communities. Some trust features require a verified university email or recognised student identity." },
    { title: "Does UniPool provide cabs or collect ride payments?", body: "No. UniPool helps students find and coordinate compatible journeys. Transport providers and fare payments remain outside UniPool unless a future feature explicitly says otherwise." },
    { title: "What are Circles?", body: "Circles are shared ledgers for friend groups, flats, trips, clubs and project teams. Members can record expenses, split them, settle balances and use Simplify Group Debts to reduce the number of settlement payments." },
    { title: "Can I track my own spending too?", body: "Yes. Personal Money is separate from Circle debt. You can add personal expenses and income/gains and see monthly money in, money out and net cashflow." },
    { title: "How do I add someone to a Circle?", body: "Search by name or email. If they already have a UniPool account, an admin can add them. If not, UniPool can prepare an email invite with the Circle join code." },
    { title: "What does Restrict do?", body: "Restrict is a lighter privacy control than Block. It lets you move an unwanted direct chat out of your normal chat surfaces without deleting history. You can undo it from Settings." },
    { title: "Why might travel data be temporarily unavailable?", body: "Some mobility features still depend on the travel backend. UniPool now keeps independent sections usable when one service is unavailable instead of failing the whole page." },
    { title: "How are shared debts simplified?", body: "UniPool calculates each member's net position and suggests fewer payments that settle those same balances. The original expenses and who paid for them are not rewritten." },
    { title: "How do I report a problem?", body: "Use report/block controls on a user where available, or contact BinaryBots at binary.bots.0110@gmail.com for account, privacy or product issues." },
  ]} />;
}
