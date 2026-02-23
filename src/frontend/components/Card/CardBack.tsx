interface CardBackProps {
  className?: string;
  animate?: boolean;
}

export function CardBack({ className = "", animate = false }: CardBackProps) {
  return (
    <div
      className={`card card-back ${animate ? "anim-deal" : ""} ${className}`}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <span style={{ fontSize: "2rem", opacity: 0.2 }}>🂠</span>
    </div>
  );
}
