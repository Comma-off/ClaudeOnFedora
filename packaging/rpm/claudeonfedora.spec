Name:           claudeonfedora
Version:        0.1.0
Release:        1%{?dist}
Summary:        Unofficial native desktop wrapper for claude.ai

License:        MIT
URL:            https://github.com/claudeonfedora/claudeonfedora
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  desktop-file-utils

# Electron ships a directory full of its own bundled .so files (ffmpeg, EGL,
# etc.). Without this, rpmbuild's automatic scanner would advertise those
# private, bundled libraries as public system-wide Provides:, which is wrong
# and can collide with the real system packages of the same name. This only
# excludes PROVIDES from the bundled tree - Requires: scanning is left alone,
# so the main claudeonfedora binary's real system dependencies (gtk4, libX11,
# libxcb, mesa-libgbm, etc.) are still picked up automatically as intended.
%global __provides_exclude_path ^%{_libdir}/%{name}/.*$

%description
ClaudeOnFedora is a minimal Electron-based desktop wrapper around
https://claude.ai, packaged natively for Fedora. It is not affiliated
with or endorsed by Anthropic.

%prep
%autosetup

%build
# Nothing to compile here. This source tarball already contains the
# pre-built Electron output (electron-app/, produced by `npm run package`
# outside of rpmbuild) because building it requires network access to fetch
# the Electron/Chromium binary - not appropriate inside a package build.
# See README.md for how the tarball is assembled.

%install
mkdir -p %{buildroot}%{_libdir}/%{name}
cp -a electron-app/. %{buildroot}%{_libdir}/%{name}/

mkdir -p %{buildroot}%{_bindir}
ln -s %{_libdir}/%{name}/claudeonfedora %{buildroot}%{_bindir}/%{name}

install -Dm644 data/claudeonfedora.desktop %{buildroot}%{_datadir}/applications/%{name}.desktop

for size in 48x48 128x128 256x256; do
  install -Dm644 data/icons/hicolor/$size/apps/claudeonfedora.png \
    %{buildroot}%{_datadir}/icons/hicolor/$size/apps/%{name}.png
done

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/%{name}.desktop

%files
%license LICENSE
%{_libdir}/%{name}/
%{_bindir}/%{name}
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/*/apps/%{name}.*

%changelog
* Thu Aug 27 2026 ClaudeOnFedora contributors <noreply@example.com> - 0.1.0-1
- Switch from GTK4/WebKitGTK to Electron (WebKitGTK could not reliably pass
  claude.ai's Cloudflare/hCaptcha bot-verification).
