import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] py-24 text-center">
      <h1 className="text-h1 font-semibold md:text-h1-lg">
        This page doesn't exist.
      </h1>
      <Link
        to="/"
        className="focus-ring mt-4 inline-block rounded text-text-2 underline hover:text-text"
      >
        Go to Pause
      </Link>
    </div>
  );
}
