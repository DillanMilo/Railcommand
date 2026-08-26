import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function inspectReviewerVideo(pathArgument) {
  const path = resolve(pathArgument);
  assert.ok(existsSync(path), `Reviewer video not found: ${path}`);
  assert.ok(statSync(path).size > 10_000, 'Reviewer video is unexpectedly small');

  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height',
    '-of', 'json',
    path,
  ], { encoding: 'utf8' });

  if (probe.status !== 0) {
    throw new Error(probe.stderr.trim() || 'ffprobe could not inspect the reviewer video');
  }

  const metadata = JSON.parse(probe.stdout);
  const video = metadata.streams.find(({ codec_type: type }) => type === 'video');
  assert.ok(video, 'Reviewer media does not contain a video stream');
  assert.ok(['h264', 'hevc'].includes(video.codec_name), `Unsupported video codec: ${video.codec_name}`);

  const durationSeconds = Number(metadata.format.duration);
  assert.ok(durationSeconds >= 45, 'Reviewer walkthrough must be at least 45 seconds');
  assert.ok(durationSeconds <= 240, 'Reviewer walkthrough must remain at most four minutes');
  assert.ok(video.width >= 1080, `Reviewer video width is below 1080 px: ${video.width}`);
  assert.ok(video.height > video.width, 'Reviewer walkthrough must remain portrait');

  return {
    path,
    bytes: statSync(path).size,
    durationSeconds,
    codec: video.codec_name,
    dimensions: `${video.width}x${video.height}`,
    audioStreams: metadata.streams.filter(({ codec_type: type }) => type === 'audio').length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const pathArgument = process.argv[2];
  if (!pathArgument) throw new Error('Usage: node scripts/verify-reviewer-video.mjs <reviewer-video.mp4>');
  console.log(JSON.stringify(inspectReviewerVideo(pathArgument), null, 2));
}
