# public/packs

The three seeded packs (§6.4, §13) are committed here by the server branch as
static assets — `/packs/nhs/psq.pdf` and so on — so the citation drawer's
"Open PDF at page N" link is a plain `<a href="/packs/nhs/psq.pdf#page=31">`.

On the frontend branch this directory is empty, so those links return 404
until the packs land. Runtime uploads are never written here (§6.4).
