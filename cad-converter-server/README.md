# CAD DWG/DGN -> DXF converter setup

This bundle adds server-side conversion plumbing for the Edgerton viewer:

- DXF still loads directly in the browser.
- DWG/DGN files are posted to `/.netlify/functions/convert-cad`.
- The Netlify function proxies the file to a converter server.
- The converter server returns DXF text, and the viewer parses it with the existing CAD overlay workflow.

## Files

- `index.html` - updated viewer with CAD overlay/conversion added to the existing Netlify package.
- `netlify/functions/convert-cad.mjs` - Netlify proxy function.
- `converter/server.js` - Express converter API.
- `converter/Dockerfile` - deployable converter container.

## Deploy steps

1. Copy `netlify/functions/convert-cad.mjs` into your Netlify site repo.
2. Deploy the `converter/` folder as a Docker web service on Render, Railway, Fly.io, Azure, etc.
3. In Netlify, set this environment variable:

   `CAD_CONVERTER_API_URL=https://YOUR-CONVERTER-SERVICE/convert`

4. Upload the updated HTML viewer.

## Important DWG/DGN note

The included converter uses `ogr2ogr` by default:

`ogr2ogr -f DXF output.dxf input.dgn`

That can work for some DGN files, but DWG and many DGN V8 files usually require a GDAL build with ODA/Teigha support or a separate CAD converter. For production, set:

`CAD_CONVERTER_COMMAND='your-converter-command {input} {output}'`

The command must create a DXF file at `{output}`.


## Existing Netlify package notes

This package keeps the existing Gemini key-holder function and adds a second Netlify function:

- `netlify/functions/gemini-chat.mjs` — existing Gemini server-side key holder.
- `netlify/functions/convert-cad.mjs` — new CAD conversion proxy.

The CAD proxy reuses the same `APP_PASSWORD` environment variable as the login screen. The viewer sends the saved team password as `x-app-password` when uploading DWG/DGN files.

DXF does not need the backend. DWG/DGN requires `CAD_CONVERTER_API_URL` in Netlify to point at your deployed converter server `/convert` endpoint.
