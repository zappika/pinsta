import Image from "next/image";

/** Decorative: the adjacent text carries the meaning. No motion or theme wash. */
export default function BrandIllustration({ coffee = false, small = false }: { coffee?: boolean; small?: boolean }) {
  const size = small ? 48 : 112;
  return <Image src={coffee ? "/brand/coffee.png" : "/brand/elephant-resin.png"} loading="eager" alt="" aria-hidden="true" width={size} height={size} className="mx-auto object-contain" />;
}
