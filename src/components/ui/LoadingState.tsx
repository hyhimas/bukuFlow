type LoadingStateProps = {
  label: string;
};

export default function LoadingState({ label }: LoadingStateProps) {
  return (
    <p role="status" className="text-sm text-app-text-muted">
      {label}
    </p>
  );
}
