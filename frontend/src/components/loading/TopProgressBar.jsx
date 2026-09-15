function TopProgressBar({ active }) {
  if (!active) return null;
  return (
    <div className="top-progress-bar" role="progressbar" aria-label="Loading" />
  );
}

export default TopProgressBar;
