Critical bug: the game isn't playable at all. When I open index.html in Chrome, the console shows:

```
Uncaught TypeError: particles is not iterable
    at updateFx (index.html:273:19)
    at update (index.html:181:3)
    at loop (index.html:421:3)

Unsafe attempt to load URL file:///path/to/breakout_challenge/opus_low/index.html from frame with URL file:///path/to/breakout_challenge/opus_low/index.html. 'file:' URLs are treated as unique security origins.
```

Please fix it.
