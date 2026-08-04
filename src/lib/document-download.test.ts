import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildArchivePaths,
  createDocumentArchive,
  type DocumentDownloadFile,
} from './document-download';

function file(overrides: Partial<DocumentDownloadFile> = {}): DocumentDownloadFile {
  return {
    id: 'attachment-1',
    document_id: 'document-1',
    document_number: 'DOC-001',
    document_title: 'Track Plan',
    file_name: 'plan.pdf',
    file_size: 4,
    download_url: 'https://files.example/plan.pdf',
    ...overrides,
  };
}

describe('document batch downloads', () => {
  it('creates safe, unique paths grouped by document', () => {
    const paths = buildArchivePaths([
      file({ document_title: '../Track/Plan', file_name: '../../plan.pdf' }),
      file({ id: 'attachment-2', document_title: '../Track/Plan', file_name: '../../plan.pdf' }),
    ]);

    assert.deepEqual(paths, [
      'DOC-001 - .._Track_Plan/plan.pdf',
      'DOC-001 - .._Track_Plan/plan (2).pdf',
    ]);
    assert.equal(paths.every((path) => !path.startsWith('/') && !path.includes('/../')), true);
  });

  it('downloads each file and returns one readable ZIP archive', async () => {
    const files = [
      file(),
      file({
        id: 'attachment-2',
        document_id: 'document-2',
        document_number: 'DOC-002',
        document_title: 'Specification',
        file_name: 'spec.txt',
        download_url: 'https://files.example/spec.txt',
      }),
    ];

    const bodies: Record<string, string> = {
      'https://files.example/plan.pdf': 'plan',
      'https://files.example/spec.txt': 'spec',
    };
    const archive = await createDocumentArchive(files, async (url) => {
      return new Response(bodies[url], { status: 200 });
    });
    const extracted = unzipSync(archive);

    assert.deepEqual(Object.keys(extracted).sort(), [
      'DOC-001 - Track Plan/plan.pdf',
      'DOC-002 - Specification/spec.txt',
    ]);
    assert.equal(strFromU8(extracted['DOC-001 - Track Plan/plan.pdf']), 'plan');
    assert.equal(strFromU8(extracted['DOC-002 - Specification/spec.txt']), 'spec');
  });

  it('reads demo data URLs directly without a network request', async () => {
    const archive = await createDocumentArchive(
      [file({ download_url: 'data:text/plain;base64,ZGVtbyBmaWxl' })],
      async () => {
        throw new Error('fetch should not be called for a data URL');
      },
    );
    const extracted = unzipSync(archive);

    assert.equal(strFromU8(extracted['DOC-001 - Track Plan/plan.pdf']), 'demo file');
  });

  it('does not create a partial archive when a file cannot be fetched', async () => {
    await assert.rejects(
      createDocumentArchive([file()], async () => new Response(null, { status: 403 })),
      /Could not download plan\.pdf/,
    );
  });

  it('limits concurrent network downloads', async () => {
    let active = 0;
    let maxActive = 0;
    const files = Array.from({ length: 12 }, (_, index) =>
      file({
        id: `attachment-${index}`,
        document_id: `document-${index}`,
        document_number: `DOC-${index}`,
        download_url: `https://files.example/${index}.txt`,
      }),
    );

    await createDocumentArchive(
      files,
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return new Response('ok', { status: 200 });
      },
      { maxConcurrentFetches: 3 },
    );

    assert.equal(maxActive, 3);
  });

  it('rejects oversized selections before fetching files', async () => {
    let fetched = false;

    await assert.rejects(
      createDocumentArchive(
        [file({ file_size: 11 })],
        async () => {
          fetched = true;
          return new Response('too late', { status: 200 });
        },
        { maxArchiveBytes: 10 },
      ),
      /Please select 1 KB or less/,
    );

    assert.equal(fetched, false);
  });

  it('explains when selected documents do not contain files', async () => {
    await assert.rejects(createDocumentArchive([]), /have uploaded files/);
  });
});
