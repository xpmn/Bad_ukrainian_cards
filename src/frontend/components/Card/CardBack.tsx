import cardImage from "../../assets/card.jpg";

interface CardBackProps {
  className?: string;
  animate?: boolean;
}

export function CardBack({ className = "", animate = false }: CardBackProps) {
  return (
    <div
      className={`card card-back ${animate ? "anim-deal" : ""} ${className}`}
      style={{
        backgroundImage: `url(${cardImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      aria-hidden="true"
    />
  );
}
