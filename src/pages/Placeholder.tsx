import { Card } from "../components/ui";

/** Stand-in until the screen is built from Figma. */
export function Placeholder({
  screen,
  title,
}: {
  screen: number;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-[720px]">
      <p className="text-label font-mono font-medium text-text-3 uppercase">
        Screen {screen}
      </p>
      <h1 className="mt-2 text-h1 font-semibold md:text-h1-lg">{title}</h1>
      <p className="mt-2 text-text-2">Coming soon.</p>
    </Card>
  );
}
