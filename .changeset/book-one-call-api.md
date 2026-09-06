---
'porejs': minor
'porejs-react': minor
---

Add the one-call reader: `<Book src|pages|file meta … />` (`porejs-react`) and
`createReaderSource(input)` (`porejs`) — point it at a file URL, a list of image
URLs, or a `File`, and get a full reader with no `ReaderSource` to implement.
Plus `<Reader onEnd>` / `settingsKey`, a tap-to-retry tile for pages that fail
to load, and `subtitle` / `volume` on `LocalFileSource` options.
