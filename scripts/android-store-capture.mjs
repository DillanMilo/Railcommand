export function selectTargetDimensions(allowedDimensions, sourceWidth, sourceHeight) {
  const landscape = sourceWidth > sourceHeight;
  const candidates = [...allowedDimensions].map((dimensions) => {
    const [width, height] = dimensions.split('x').map(Number);
    return { width, height, dimensions };
  });
  return candidates.find((candidate) => (candidate.width > candidate.height) === landscape)
    ?? candidates[0];
}

export function calculateCenteredCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  if (sourceAspect > targetAspect) {
    return { width: Math.round(sourceHeight * targetAspect), height: sourceHeight };
  }
  return { width: sourceWidth, height: Math.round(sourceWidth / targetAspect) };
}
