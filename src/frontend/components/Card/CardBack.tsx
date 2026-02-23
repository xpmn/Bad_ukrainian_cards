// Card back-face — implemented in task 3.6
interface CardBackProps {
  className?: string;
}

export function CardBack({ className = "" }: CardBackProps) {
  return <div className={`card-back ${className}`} />;
}
