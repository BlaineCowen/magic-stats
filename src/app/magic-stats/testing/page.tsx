import { NflQuery } from "@/components/nfl-query";

// Same UI with every attempt shown and the result cache bypassed.
export default function TestingPage() {
  return <NflQuery debug />;
}
