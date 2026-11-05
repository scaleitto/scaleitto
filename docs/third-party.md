# Third-party data

## Algeria wilaya boundaries (analytics map)

`src/lib/algeria-map.ts` holds SVG outlines derived from `data/geojson/wilaya-boundaries.geojson` of
[geoalgeria](https://www.npmjs.com/package/geoalgeria) 2.4.0 (code and administrative compilation MIT, © Yasser's studio).
The boundary polygons themselves come from OpenStreetMap and are licensed under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors.
The derived outlines in `algeria-map.ts` stay under the ODbL; the map shows the attribution under it
(`analytics.mapAttribution`). Projection: equirectangular scaled by cos(28°), 600 units wide.

## 3D illustrations (homepage)

`public/home/*.webp` are icons from **3dicons** by Vijay Verma (https://3dicons.co, github.com/realvjy/3Dicons), released under
**CC0 1.0** (public domain: free for commercial use, no attribution required). "Color" style, dynamic angle, resized to 320 px WebP.
