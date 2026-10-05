/** Flat companion to Vicolo's resin elephant; intentionally inherits the UI ink. */
export default function ElephantMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="210 160 604 692" fill="currentColor" aria-hidden="true" focusable="false">
      <path fillRule="evenodd" d="M512 181C357 181 231 307 231 462v311c0 38 19 57 57 57h114c37 0 56-19 56-56V657a54 54 0 0 1 108 0v117c0 37 19 56 56 56h115c37 0 56-19 56-57V462c0-155-126-281-281-281Zm87 140a83 83 0 1 0 0 166 83 83 0 0 0 0-166Z" />
    </svg>
  );
}
