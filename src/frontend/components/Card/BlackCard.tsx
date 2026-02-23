// Black card — implemented in task 3.6
interface BlackCardProps {
  text: string;
}

export function BlackCard({ text }: BlackCardProps) {
  return <div className="black-card">{text}</div>;
}
