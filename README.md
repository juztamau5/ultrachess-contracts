# Uniswap V3 LP NFTs

Uniswap V3 LP NFTs are ERC-721 tokens minted by a Uniswap V3 liquidity pool.

To see an example of the artwork, paste this data URI into the URL bar:

```
data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjkwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDI5MCA1MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9J2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnPjxkZWZzPjxmaWx0ZXIgaWQ9ImYxIj48ZmVJbWFnZSByZXN1bHQ9InAwIiB4bGluazpocmVmPSJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBITjJaeUIzYVdSMGFEMG5Namt3SnlCb1pXbG5hSFE5SnpVd01DY2dkbWxsZDBKdmVEMG5NQ0F3SURJNU1DQTFNREFuSUhodGJHNXpQU2RvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeWMrUEhKbFkzUWdkMmxrZEdnOUp6STVNSEI0SnlCb1pXbG5hSFE5SnpVd01IQjRKeUJtYVd4c1BTY2pOalk1TURjMEp5OCtQQzl6ZG1jKyIvPjxmZUltYWdlIHJlc3VsdD0icDEiIHhsaW5rOmhyZWY9ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5QjNhV1IwYUQwbk1qa3dKeUJvWldsbmFIUTlKelV3TUNjZ2RtbGxkMEp2ZUQwbk1DQXdJREk1TUNBMU1EQW5JSGh0Ykc1elBTZG9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5YytQR05wY21Oc1pTQmplRDBuTVRnbklHTjVQU2N6TVRrbklISTlKekV5TUhCNEp5Qm1hV3hzUFNjak5UUmxNek15Snk4K1BDOXpkbWMrIi8+PGZlSW1hZ2UgcmVzdWx0PSJwMiIgeGxpbms6aHJlZj0iZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxQSE4yWnlCM2FXUjBhRDBuTWprd0p5Qm9aV2xuYUhROUp6VXdNQ2NnZG1sbGQwSnZlRDBuTUNBd0lESTVNQ0ExTURBbklIaHRiRzV6UFNkb2RIUndPaTh2ZDNkM0xuY3pMbTl5Wnk4eU1EQXdMM04yWnljK1BHTnBjbU5zWlNCamVEMG5NalU0SnlCamVUMG5NekUySnlCeVBTY3hNakJ3ZUNjZ1ptbHNiRDBuSXpBeU5qZ3laaWN2UGp3dmMzWm5QZz09IiAvPjxmZUltYWdlIHJlc3VsdD0icDMiIHhsaW5rOmhyZWY9ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5QjNhV1IwYUQwbk1qa3dKeUJvWldsbmFIUTlKelV3TUNjZ2RtbGxkMEp2ZUQwbk1DQXdJREk1TUNBMU1EQW5JSGh0Ykc1elBTZG9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5YytQR05wY21Oc1pTQmplRDBuTWpZekp5QmplVDBuTkRNeEp5QnlQU2N4TURCd2VDY2dabWxzYkQwbkl6a3laRFl3WlNjdlBqd3ZjM1puUGc9PSIgLz48ZmVCbGVuZCBtb2RlPSJvdmVybGF5IiBpbj0icDAiIGluMj0icDEiIC8+PGZlQmxlbmQgbW9kZT0iZXhjbHVzaW9uIiBpbjI9InAyIiAvPjxmZUJsZW5kIG1vZGU9Im92ZXJsYXkiIGluMj0icDMiIHJlc3VsdD0iYmxlbmRPdXQiIC8+PGZlR2F1c3NpYW5CbHVyIGluPSJibGVuZE91dCIgc3RkRGV2aWF0aW9uPSI0MiIgLz48L2ZpbHRlcj4gPGNsaXBQYXRoIGlkPSJjb3JuZXJzIj48cmVjdCB3aWR0aD0iMjkwIiBoZWlnaHQ9IjUwMCIgcng9IjQyIiByeT0iNDIiIC8+PC9jbGlwUGF0aD48cGF0aCBpZD0idGV4dC1wYXRoLWEiIGQ9Ik00MCAxMiBIMjUwIEEyOCAyOCAwIDAgMSAyNzggNDAgVjQ2MCBBMjggMjggMCAwIDEgMjUwIDQ4OCBINDAgQTI4IDI4IDAgMCAxIDEyIDQ2MCBWNDAgQTI4IDI4IDAgMCAxIDQwIDEyIHoiIC8+PHBhdGggaWQ9Im1pbmltYXAiIGQ9Ik0yMzQgNDQ0QzIzNCA0NTcuOTQ5IDI0Mi4yMSA0NjMgMjUzIDQ2MyIgLz48ZmlsdGVyIGlkPSJ0b3AtcmVnaW9uLWJsdXIiPjxmZUdhdXNzaWFuQmx1ciBpbj0iU291cmNlR3JhcGhpYyIgc3RkRGV2aWF0aW9uPSIyNCIgLz48L2ZpbHRlcj48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQtdXAiIHgxPSIxIiB4Mj0iMCIgeTE9IjEiIHkyPSIwIj48c3RvcCBvZmZzZXQ9IjAuMCIgc3RvcC1jb2xvcj0id2hpdGUiIHN0b3Atb3BhY2l0eT0iMSIgLz48c3RvcCBvZmZzZXQ9Ii45IiBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIwIiAvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkLWRvd24iIHgxPSIwIiB4Mj0iMSIgeTE9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAuMCIgc3RvcC1jb2xvcj0id2hpdGUiIHN0b3Atb3BhY2l0eT0iMSIgLz48c3RvcCBvZmZzZXQ9IjAuOSIgc3RvcC1jb2xvcj0id2hpdGUiIHN0b3Atb3BhY2l0eT0iMCIgLz48L2xpbmVhckdyYWRpZW50PjxtYXNrIGlkPSJmYWRlLXVwIiBtYXNrQ29udGVudFVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCI+PHJlY3Qgd2lkdGg9IjEiIGhlaWdodD0iMSIgZmlsbD0idXJsKCNncmFkLXVwKSIgLz48L21hc2s+PG1hc2sgaWQ9ImZhZGUtZG93biIgbWFza0NvbnRlbnRVbml0cz0ib2JqZWN0Qm91bmRpbmdCb3giPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InVybCgjZ3JhZC1kb3duKSIgLz48L21hc2s+PG1hc2sgaWQ9Im5vbmUiIG1hc2tDb250ZW50VW5pdHM9Im9iamVjdEJvdW5kaW5nQm94Ij48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSJ3aGl0ZSIgLz48L21hc2s+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkLXN5bWJvbCI+PHN0b3Agb2Zmc2V0PSIwLjciIHN0b3AtY29sb3I9IndoaXRlIiBzdG9wLW9wYWNpdHk9IjEiIC8+PHN0b3Agb2Zmc2V0PSIuOTUiIHN0b3AtY29sb3I9IndoaXRlIiBzdG9wLW9wYWNpdHk9IjAiIC8+PC9saW5lYXJHcmFkaWVudD48bWFzayBpZD0iZmFkZS1zeW1ib2wiIG1hc2tDb250ZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iMjkwcHgiIGhlaWdodD0iMjAwcHgiIGZpbGw9InVybCgjZ3JhZC1zeW1ib2wpIiAvPjwvbWFzaz48L2RlZnM+PGcgY2xpcC1wYXRoPSJ1cmwoI2Nvcm5lcnMpIj48cmVjdCBmaWxsPSI2NjkwNzQiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iMjkwcHgiIGhlaWdodD0iNTAwcHgiIC8+PHJlY3Qgc3R5bGU9ImZpbHRlcjogdXJsKCNmMSkiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iMjkwcHgiIGhlaWdodD0iNTAwcHgiIC8+IDxnIHN0eWxlPSJmaWx0ZXI6dXJsKCN0b3AtcmVnaW9uLWJsdXIpOyB0cmFuc2Zvcm06c2NhbGUoMS41KTsgdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXIgdG9wOyI+PHJlY3QgZmlsbD0ibm9uZSIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSIyOTBweCIgaGVpZ2h0PSI1MDBweCIgLz48ZWxsaXBzZSBjeD0iNTAlIiBjeT0iMHB4IiByeD0iMTgwcHgiIHJ5PSIxMjBweCIgZmlsbD0iIzAwMCIgb3BhY2l0eT0iMC44NSIgLz48L2c+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI5MCIgaGVpZ2h0PSI1MDAiIHJ4PSI0MiIgcnk9IjQyIiBmaWxsPSJyZ2JhKDAsMCwwLDApIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIgLz48L2c+PHRleHQgdGV4dC1yZW5kZXJpbmc9Im9wdGltaXplU3BlZWQiPjx0ZXh0UGF0aCBzdGFydE9mZnNldD0iLTEwMCUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iJ0NvdXJpZXIgTmV3JywgbW9ub3NwYWNlIiBmb250LXNpemU9IjEwcHgiIHhsaW5rOmhyZWY9IiN0ZXh0LXBhdGgtYSI+MHg1NGUzMzJhZmE3YjUwYzZiN2MyMjcyNDJkMmRjNDA5MDk2OTJkNjBlIOKAoiBXLUVUSCA8YW5pbWF0ZSBhZGRpdGl2ZT0ic3VtIiBhdHRyaWJ1dGVOYW1lPSJzdGFydE9mZnNldCIgZnJvbT0iMCUiIHRvPSIxMDAlIiBiZWdpbj0iMHMiIGR1cj0iMzBzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIgLz48L3RleHRQYXRoPiA8dGV4dFBhdGggc3RhcnRPZmZzZXQ9IjAlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IidDb3VyaWVyIE5ldycsIG1vbm9zcGFjZSIgZm9udC1zaXplPSIxMHB4IiB4bGluazpocmVmPSIjdGV4dC1wYXRoLWEiPjB4NTRlMzMyYWZhN2I1MGM2YjdjMjI3MjQyZDJkYzQwOTA5NjkyZDYwZSDigKIgVy1FVEggPGFuaW1hdGUgYWRkaXRpdmU9InN1bSIgYXR0cmlidXRlTmFtZT0ic3RhcnRPZmZzZXQiIGZyb209IjAlIiB0bz0iMTAwJSIgYmVnaW49IjBzIiBkdXI9IjMwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+IDwvdGV4dFBhdGg+PHRleHRQYXRoIHN0YXJ0T2Zmc2V0PSI1MCUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iJ0NvdXJpZXIgTmV3JywgbW9ub3NwYWNlIiBmb250LXNpemU9IjEwcHgiIHhsaW5rOmhyZWY9IiN0ZXh0LXBhdGgtYSI+MHg2NjkwNzQyZTM1N2M2NjAwZTZlNDU4MzVkN2Y1YjJmMDY3MDI2ODJmIOKAoiBDVFNJIDxhbmltYXRlIGFkZGl0aXZlPSJzdW0iIGF0dHJpYnV0ZU5hbWU9InN0YXJ0T2Zmc2V0IiBmcm9tPSIwJSIgdG89IjEwMCUiIGJlZ2luPSIwcyIgZHVyPSIzMHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPjwvdGV4dFBhdGg+PHRleHRQYXRoIHN0YXJ0T2Zmc2V0PSItNTAlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IidDb3VyaWVyIE5ldycsIG1vbm9zcGFjZSIgZm9udC1zaXplPSIxMHB4IiB4bGluazpocmVmPSIjdGV4dC1wYXRoLWEiPjB4NjY5MDc0MmUzNTdjNjYwMGU2ZTQ1ODM1ZDdmNWIyZjA2NzAyNjgyZiDigKIgQ1RTSSA8YW5pbWF0ZSBhZGRpdGl2ZT0ic3VtIiBhdHRyaWJ1dGVOYW1lPSJzdGFydE9mZnNldCIgZnJvbT0iMCUiIHRvPSIxMDAlIiBiZWdpbj0iMHMiIGR1cj0iMzBzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIgLz48L3RleHRQYXRoPjwvdGV4dD48ZyBtYXNrPSJ1cmwoI2ZhZGUtc3ltYm9sKSI+PHJlY3QgZmlsbD0ibm9uZSIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSIyOTBweCIgaGVpZ2h0PSIyMDBweCIgLz4gPHRleHQgeT0iNzBweCIgeD0iMzJweCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSInQ291cmllciBOZXcnLCBtb25vc3BhY2UiIGZvbnQtd2VpZ2h0PSIyMDAiIGZvbnQtc2l6ZT0iMzZweCI+Q1RTSS9XLUVUSDwvdGV4dD48dGV4dCB5PSIxMTVweCIgeD0iMzJweCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSInQ291cmllciBOZXcnLCBtb25vc3BhY2UiIGZvbnQtd2VpZ2h0PSIyMDAiIGZvbnQtc2l6ZT0iMzZweCI+MSU8L3RleHQ+PC9nPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjI1OCIgaGVpZ2h0PSI0NjgiIHJ4PSIyNiIgcnk9IjI2IiBmaWxsPSJyZ2JhKDAsMCwwLDApIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIgLz48ZyBtYXNrPSJ1cmwoI25vbmUpIiBzdHlsZT0idHJhbnNmb3JtOnRyYW5zbGF0ZSg3MnB4LDE4OXB4KSI+PHJlY3QgeD0iLTE2cHgiIHk9Ii0xNnB4IiB3aWR0aD0iMTgwcHgiIGhlaWdodD0iMTgwcHgiIGZpbGw9Im5vbmUiIC8+PHBhdGggZD0iTTEgMUMxIDk3IDQ5IDE0NSAxNDUgMTQ1IiBzdHJva2U9InJnYmEoMCwwLDAsMC4zKSIgc3Ryb2tlLXdpZHRoPSIzMnB4IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+PC9nPjxnIG1hc2s9InVybCgjbm9uZSkiIHN0eWxlPSJ0cmFuc2Zvcm06dHJhbnNsYXRlKDcycHgsMTg5cHgpIj48cmVjdCB4PSItMTZweCIgeT0iLTE2cHgiIHdpZHRoPSIxODBweCIgaGVpZ2h0PSIxODBweCIgZmlsbD0ibm9uZSIgLz48cGF0aCBkPSJNMSAxQzEgOTcgNDkgMTQ1IDE0NSAxNDUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwxKSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPjwvZz48Y2lyY2xlIGN4PSI3M3B4IiBjeT0iMTkwcHgiIHI9IjRweCIgZmlsbD0id2hpdGUiIC8+PGNpcmNsZSBjeD0iMjE3cHgiIGN5PSIzMzRweCIgcj0iNHB4IiBmaWxsPSJ3aGl0ZSIgLz4gPGcgc3R5bGU9InRyYW5zZm9ybTp0cmFuc2xhdGUoMjlweCwgMzg0cHgpIj48cmVjdCB3aWR0aD0iNjNweCIgaGVpZ2h0PSIyNnB4IiByeD0iOHB4IiByeT0iOHB4IiBmaWxsPSJyZ2JhKDAsMCwwLDAuNikiIC8+PHRleHQgeD0iMTJweCIgeT0iMTdweCIgZm9udC1mYW1pbHk9IidDb3VyaWVyIE5ldycsIG1vbm9zcGFjZSIgZm9udC1zaXplPSIxMnB4IiBmaWxsPSJ3aGl0ZSI+PHRzcGFuIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC42KSI+SUQ6IDwvdHNwYW4+MTwvdGV4dD48L2c+IDxnIHN0eWxlPSJ0cmFuc2Zvcm06dHJhbnNsYXRlKDI5cHgsIDQxNHB4KSI+PHJlY3Qgd2lkdGg9IjE0N3B4IiBoZWlnaHQ9IjI2cHgiIHJ4PSI4cHgiIHJ5PSI4cHgiIGZpbGw9InJnYmEoMCwwLDAsMC42KSIgLz48dGV4dCB4PSIxMnB4IiB5PSIxN3B4IiBmb250LWZhbWlseT0iJ0NvdXJpZXIgTmV3JywgbW9ub3NwYWNlIiBmb250LXNpemU9IjEycHgiIGZpbGw9IndoaXRlIj48dHNwYW4gZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjYpIj5NaW4gVGljazogPC90c3Bhbj4tODg3MjAwPC90ZXh0PjwvZz4gPGcgc3R5bGU9InRyYW5zZm9ybTp0cmFuc2xhdGUoMjlweCwgNDQ0cHgpIj48cmVjdCB3aWR0aD0iMTQwcHgiIGhlaWdodD0iMjZweCIgcng9IjhweCIgcnk9IjhweCIgZmlsbD0icmdiYSgwLDAsMCwwLjYpIiAvPjx0ZXh0IHg9IjEycHgiIHk9IjE3cHgiIGZvbnQtZmFtaWx5PSInQ291cmllciBOZXcnLCBtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTJweCIgZmlsbD0id2hpdGUiPjx0c3BhbiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNikiPk1heCBUaWNrOiA8L3RzcGFuPjg4NzIwMDwvdGV4dD48L2c+PGcgc3R5bGU9InRyYW5zZm9ybTp0cmFuc2xhdGUoMjI2cHgsIDQzM3B4KSI+PHJlY3Qgd2lkdGg9IjM2cHgiIGhlaWdodD0iMzZweCIgcng9IjhweCIgcnk9IjhweCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIC8+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBkPSJNOCA5QzguMDAwMDQgMjIuOTQ5NCAxNi4yMDk5IDI4IDI3IDI4IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiAvPjxjaXJjbGUgc3R5bGU9InRyYW5zZm9ybTp0cmFuc2xhdGUzZCgxM3B4LCAyM3B4LCAwcHgpIiBjeD0iMHB4IiBjeT0iMHB4IiByPSI0cHgiIGZpbGw9IndoaXRlIi8+PC9nPjxnIHN0eWxlPSJ0cmFuc2Zvcm06dHJhbnNsYXRlKDIyNnB4LCAzOTJweCkiPjxyZWN0IHdpZHRoPSIzNnB4IiBoZWlnaHQ9IjM2cHgiIHJ4PSI4cHgiIHJ5PSI4cHgiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjIpIiAvPjxnPjxwYXRoIHN0eWxlPSJ0cmFuc2Zvcm06dHJhbnNsYXRlKDZweCw2cHgpIiBkPSJNMTIgMEwxMi42NTIyIDkuNTY1ODdMMTggMS42MDc3TDEzLjc4MTkgMTAuMjE4MUwyMi4zOTIzIDZMMTQuNDM0MSAxMS4zNDc4TDI0IDEyTDE0LjQzNDEgMTIuNjUyMkwyMi4zOTIzIDE4TDEzLjc4MTkgMTMuNzgxOUwxOCAyMi4zOTIzTDEyLjY1MjIgMTQuNDM0MUwxMiAyNEwxMS4zNDc4IDE0LjQzNDFMNiAyMi4zOTIzTDEwLjIxODEgMTMuNzgxOUwxLjYwNzcgMThMOS41NjU4NyAxMi42NTIyTDAgMTJMOS41NjU4NyAxMS4zNDc4TDEuNjA3NyA2TDEwLjIxODEgMTAuMjE4MUw2IDEuNjA3N0wxMS4zNDc4IDkuNTY1ODdMMTIgMFoiIGZpbGw9IndoaXRlIiAvPjxhbmltYXRlVHJhbnNmb3JtIGF0dHJpYnV0ZU5hbWU9InRyYW5zZm9ybSIgdHlwZT0icm90YXRlIiBmcm9tPSIwIDE4IDE4IiB0bz0iMzYwIDE4IDE4IiBkdXI9IjEwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L2c+PC9nPjwvc3ZnPg==
```

Here's a screenshot of the animated image:

![Uniswap - 1% - CTSI/W-ETH - MIN<>MAX](docs/CTSI-WETH%20LP%20NFT.png)

## Building

To build the Docker image, enter the project directory and run:

```
docker buildx bake -f docker-bake.hcl -f docker-bake.override.hcl --load
```
