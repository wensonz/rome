module.exports = {
    "name": "apache_2.2.22",
    "configuration": {
        "files": [
            {
                "name": "apache_2.2.22_main_configuration",
                "path": "/usr/local/sinasrv2/etc/httpd.conf",
                "owner": "root:root",
                "permission": "0600",
                "template":"apache_2.2.22_main_configuration",
                "data": {
                    "load_module": [
                        {
                            "name": "authz_host_module",
                            "path": "modules/mod_authz_host.so"
                        },
                        {
                            "name": "include_module",
                            "path": "modules/mod_include.so"
                        },
                        {
                            "name": "filter_module",
                            "path": "modules/mod_filter.so"
                        },
                        {
                            "name": "log_config_module",
                            "path": "modules/mod_log_config.so"
                        },
                        {
                            "name": "env_module",
                            "path": "modules/mod_env.so"
                        },
                        {
                            "name": "status_module",
                            "path": "modules/mod_status.so"
                        },
                        {
                            "name": "expires_module",
                            "path": "modules/mod_expires.so"
                        },
                        {
                            "name": "headers_module",
                            "path": "modules/mod_headers.so"
                        },
                        {
                            "name": "setenvif_module",
                            "path": "modules/mod_setenvif.so"
                        },
                        {
                            "name": "mime_module",
                            "path": "modules/mod_mime.so"
                        },
                        {
                            "name": "dir_module",
                            "path": "modules/mod_dir.so"
                        },
                        {
                            "name": "alias_module",
                            "path": "modules/mod_alias.so"
                        },
                        {
                            "name": "rewrite_module",
                            "path": "modules/mod_rewrite.so"
                        },
                        {
                            "name": "php5_module",
                            "path": "modules/libphp5.so"
                        },
                        {
                            "name": "deflate_module",
                            "path": "modules/mod_deflate.so"
                        },
                        {
                            "name": "vhost_limit_module",
                            "path": "modules/mod_vhost_limit.so"
                        },
                        {
                            "name": "proxy_module",
                            "path": "modules/mod_proxy.so"
                        },
                        {
                            "name": "proxy_http_module",
                            "path": "modules/mod_proxy_http.so"
                        },
                        {
                            "name": "extract_forwarded_module",
                            "path": "modules/mod_extract_forwarded.so"
                        },
                        {
                            "name": "sina_usertrack_module",
                            "path": "modules/mod_sina_usertrack.so"
                        }
                    ]
                }
            }
        ]
    },
    "changelog": "The role contains some common data in apache 2.2.22 main configuration file."
}
