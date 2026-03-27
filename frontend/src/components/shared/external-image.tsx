import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

type ExternalImageProps = Omit<ImageProps, "loader" | "alt"> & {
  alt: string;
};

export function ExternalImage({ alt, ...props }: ExternalImageProps) {
  return <Image {...props} alt={alt} loader={passthroughLoader} unoptimized />;
}