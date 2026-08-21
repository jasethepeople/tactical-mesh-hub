export type QrFrame = { data: Uint8ClampedArray; width: number; height: number };
export type QrDecoder = (data: Uint8ClampedArray, width: number, height: number) => string | null;

export async function requestCameraStream(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>): Promise<MediaStream> {
  return getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
}

export function stopCameraStream(stream: Pick<MediaStream, "getTracks"> | null | undefined): void {
  stream?.getTracks().forEach(track => track.stop());
}

export function decodeQrFrame(frame: QrFrame, decoder: QrDecoder): string | null {
  return decoder(frame.data, frame.width, frame.height);
}
