#
# Begin Our Macros Define.
#
%define _name_prefix           sinasrv2-rome
%define _signature             gpg
%define _gpg_name              SinaSRV-2 Key <sinasrv-2key@sys.sina.com.cn>
%define _srcname               %{_name}-%{version}.tar.gz
%define _name                  vatican
%define _version               0.1.0
%define _serverdir             /usr/local/sinasrv2/rome/

#
# Begin RPM Package Define.
#
Summary: %{_name}-%{_version} (RHEL AS%{_osvernum} / CentOS%{_osvernum})
Name: %{_name_prefix}-%{_name}
Version: %{_version}
Release: 17
Vendor: Sina Beijing System Develp Dept. 2012
License: GPL
Group: Applications/%{_name_prefix}
URL: http://sys.sina.com.cn/download/
Source0: http://sys.sina.com.cn/download/%{_name}-%{version}.tar.gz
BuildRoot: %{_tmppath}/%{name}-buildroot
BuildRequires: rpm
Requires: rpm >= 4.2, sinasrv2-node, sinasrv2-rome, sinasrv2-rome-log4js = 0.5.2, sinasrv2-rome-mongodb = 1.1.6, sinasrv2-rome-mongodb-ext = 0.0.1, sinasrv2-rome-q = 0.8.8, sinasrv2-rome-express = 3.0.0, sinasrv2-rome-express-reroute = 1.0.2, sinasrv2-rome-rome-client = 0.0.1, sinasrv2-rome-request = 2.11.0

%description
Rome Db Service

Version %{version}, rpm prebuilded package release.
Maintainer : yanchao1@staff.sina.com.cn <System Develp Dept.>
Copyright (c) 2012 SINA Inc. All rights reserved.

%prep
echo %{_exist}
%setup -q -n %{_name}-%{version}

%build

%install
 rm -rf $RPM_BUILD_ROOT
 NODE_MOUDLES_DIR=$RPM_BUILD_ROOT%{_serverdir}/%{_name}
 mkdir -p $NODE_MOUDLES_DIR
 cp -r src/* $NODE_MOUDLES_DIR
 chmod 755 $NODE_MOUDLES_DIR

%post

%clean
rm -rf $RPM_BUILD_ROOT

%preun

%postun
 NODE_MOUDLES_DIR=$RPM_BUILD_ROOT/%{_serverdir}

%files

 %defattr(-,root,root)

 %{_serverdir}

 %dir

 %config

%changelog
