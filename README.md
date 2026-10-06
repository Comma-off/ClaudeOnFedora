# ClaudeOnFedora

A desktop app for using [Claude](https://claude.ai) on Fedora Linux. It opens
Claude in its own window - separate from your browser, with its own icon and
taskbar entry - and remembers that you're logged in between launches, just
like any other desktop app.

This exists because Anthropic's official Claude desktop app currently only
supports Debian-based systems (like Ubuntu), leaving Fedora without an
official option.

**This is an unofficial, community-made project. It is not made by, affiliated
with, or endorsed by Anthropic.** It's free and open source (MIT license).

## Installing

Download the `.rpm` file and install it:

```sh
sudo dnf install ./claudeonfedora-0.1.0-1.fc44.x86_64.rpm
```

Once installed, you'll find "Claude" in your applications menu like any other
app.

## Using it

- Log in the first time you open it - after that, it keeps you signed in.
- **Ctrl+R** reloads the page, **Ctrl+Q** quits, **Ctrl +** / **Ctrl -** /
  **Ctrl 0** zoom in, out, and reset.
- Links to other websites (help articles, terms of service, etc.) open in
  your regular web browser instead of inside the app.
- Running `claudeonfedora --new-window` from a terminal opens a second window
  if you want to view two conversations side by side.

### Good to know

**You'll still see claude.ai's own "Download desktop app" button inside the
app.** That's expected, not a bug. This app works by showing you the real
claude.ai website in its own dedicated window, rather than being rebuilt from
scratch - so anything the website itself displays, including its own prompts,
still shows up normally. It's safe to ignore.

Your login stays on your own computer, the same way it would in a normal
browser - nothing is sent anywhere beyond what claude.ai itself already
receives when you use it.

## Building it yourself / packaging

If you'd rather build the app from source instead of using a pre-built
`.rpm`, see below. You'll need Node.js installed first
(`sudo dnf install nodejs22 nodejs22-npm`).

**Run it directly:**

```sh
npm install
npm start
```

**Build the `.rpm` package:**

Electron needs internet access to download its bundled Chromium, which isn't
appropriate to do inside an RPM build. So the app is packaged first, and that
pre-built output is what goes into the RPM:

```sh
npm install
npm run package                       # produces dist/claudeonfedora-linux-x64/

mkdir -p /tmp/claudeonfedora-0.1.0
cp -r dist/claudeonfedora-linux-x64 /tmp/claudeonfedora-0.1.0/electron-app
cp -r data LICENSE /tmp/claudeonfedora-0.1.0/
tar -C /tmp -czf ~/rpmbuild/SOURCES/claudeonfedora-0.1.0.tar.gz claudeonfedora-0.1.0

rpmbuild -bb packaging/rpm/claudeonfedora.spec
```

The built `.rpm` will be under `~/rpmbuild/RPMS/x86_64/`.

If it ever fails to launch after installing with a "missing library" error,
that's worth reporting as an issue - it means one specific system library
needs to be added to the package's dependency list.

## Why this uses Electron

An earlier version of this app used a lighter-weight approach (GTK4 +
WebKitGTK, Fedora's built-in web engine) to avoid the size of bundling a whole
second browser engine. It worked, but Anthropic's login page runs bot/spam
verification (hCaptcha and Cloudflare's challenge widget) that a non-standard
browser engine couldn't reliably get past, no matter how it identified itself.
Electron includes a real, standard Chromium browser engine - the same kind
Chrome itself uses - so it passes that verification the same way a normal
browser would. The tradeoff is a larger download and somewhat higher memory
use than the lighter approach would have had, in exchange for it actually
working reliably.

## Limitations

- The window doesn't remember its size or position between launches yet.
- No desktop notifications yet.
- Not yet listed with a rich entry in GNOME Software / KDE Discover (planned).
