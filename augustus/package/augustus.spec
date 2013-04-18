%define	_name_prefix sinasrv2-rome
%define _name augustus
%define _version 0.1.0
%define _install_dir /usr/local/sinasrv2/rome/%{_name}
%define _bindir /usr/local/sinasrv2/bin

Summary: Unified Configuration Management component of ROME
Name: %{_name_prefix}-%{_name}
Version: %{_version}
Release: 6
License: GPL
Group: Application/System
Source0: %{_name}-%{_version}.tar.gz
BuildRoot: %{_tmppath}/%{name}-buildroot
Requires: sinasrv2-node, sinasrv2-rome, sinasrv2-rome-dust, sinasrv2-rome-log4js, sinasrv2-rome-rome-client, sinasrv2-rome-async, sinasrv2-rome-node-uuid, sinasrv2-rome-request, sinasrv2-rome-natives

%description
Unified Configuration Management component of ROME

%package client
Summary: client tool to download configuration and put them in proper path.
Group: Application/System
Requires: python

%description client
client tool to download configuration and put them in proper path.

%prep
%setup -q -n %{_name}-%{_version}

%build
true

%install
%{__rm} -rf %{buildroot}
mkdir -p %{buildroot}%{_install_dir}
cp -r src/index.js src/server.js src/src %{buildroot}%{_install_dir}
mkdir -p %{buildroot}%{_bindir}
cp src/client/* %{buildroot}%{_bindir}

%clean
%{__rm} -rf %{buildroot}

%files
%defattr(-,root,root)
%{_install_dir}

%files client
%defattr(755,root,root)
/usr/local/sinasrv2/bin/*

%changelog
