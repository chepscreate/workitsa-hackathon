import SafetyContent from "./SafetyContent";

export const metadata = {
  alternates: { canonical: "/safety/" },
  title: "Safety guide — Workit",
  description:
    "How to stay safe on Workit — for both employers hiring workers and workers taking jobs.",
};

export default function SafetyPage() {
  return <SafetyContent />;
}
