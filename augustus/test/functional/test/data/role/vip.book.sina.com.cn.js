module.exports = {
    "name": "vip.book.sina.com.cn",
    "configuration": {
        "files": [
            {
                "name": "vip.book.sina.com.cn_vhost_configuration",
                "path": "/usr/local/sinasrv2/etc/conf.d/vip.book.sina.com.cn-vhost.conf",
                "owner": "root:root",
                "permission": "0600",
                "template":"vip.book.sina.com.cn_vhost",
                "data": {
                    "server_name": "vip.book.sina.com.cn",
                    "server_alias": [
                        {
                            "name": "i.vip.book.sina.com.cn",
                            "env_variable": "ivipbookgroup"
                        },
                        {
                            "name": "vip.book.2010.sina.com.cn",
                            "env_variable": "vipbook2010group"
                        },
                        {
                            "name": "api.vip.book.sina.com.cn",
                            "env_variable": "apivipbookgroup"
                        }
                    ],
                    "database": [
                        {
                            "number": "",
                            "port": "3336",
                            "name": "vipbook",
                            "user": "vipbook",
                            "password": "oSxdkxjch4",
                            "read_port": "3336",
                            "read_name": "vipbook",
                            "read_user": "vipbook_r",
                            "read_password": "sgDMek3XjE"
                        },
                        {
                            "number": "2",
                            "port": "3336",
                            "name": "vipbook_hd",
                            "user": "vipbook",
                            "password": "oSxdkxjch4",
                            "read_port": "3336",
                            "read_name": "vipbook_hd",
                            "read_user": "vipbook_r",
                            "read_password": "sgDMek3XjE"
                        },
                        {
                            "number": "3",
                            "port": "3336",
                            "name": "vipbook",
                            "user": "vipbook",
                            "password": "oSxdkxjch4",
                            "read_port": "3336",
                            "read_name": "vipbook",
                            "read_user": "vipbook_r",
                            "read_password": "sgDMek3XjE"
                        },
                        {
                            "number": "4",
                            "port": "3364",
                            "name": "vipbook",
                            "user": "vipbook",
                            "password": "f3u4w8n7b3h",
                            "read_port": "3364",
                            "read_name": "vipbook",
                            "read_user": "vipbook_r",
                            "read_password": "DAKAdfad3k4lzx"
                        },
                        {
                            "number": "5",
                            "port": "3365",
                            "name": "vipbook",
                            "user": "vipbook",
                            "password": "f3u4w8n7b3h",
                            "read_port": "3365",
                            "read_name": "vipbook",
                            "read_user": "vipbook_r",
                            "read_password": "DAKAdfad3k4lzx"
                        }
                    ],
                    "memcached": [
                        {
                            "number": "",
                            "hosts": ["10.44.6.31", "10.44.6.34"],
                            "port": "7601"
                        },
                        {
                            "number": "2",
                            "hosts": ["10.44.6.31", "10.44.6.34"],
                            "port": "7661"
                        },
                        {
                            "number": "3",
                            "hosts": ["10.44.6.31", "10.44.6.34"],
                            "port": "7662"
                        }
                    ],
                    "rewrite_rule": [
                        {
                            "rule": {
                                "pattern": "^/book/index_([0-9a-zA-Z]+).html$",
                                "substitution": "/book/index.php?book=$1",
                                "flag": "[L]"
                            }
                        },
                        {
                            "rule": {
                                "pattern": "^/book/chapter_([0-9]+)_([0-9]+).html$",
                                "substitution": "/book/book_read.php?book=$1&chapter=$2",
                                "flag": "[L]"
                            }
                        },
                        {
                            "rule": {
                                "pattern": "^/vip/index.html$",
                                "substitution": "/vip/index.php",
                                "flag": "[L]"
                            }
                        },
                        {
                            "rule": {
                                "pattern": "^/(books|suitebooks)",
                                "substitution": "/index.php/$0",
                                "flag": "[L]"
                            }
                        },
                        {
                            "condition": [
                                {
                                    "test": "%{REQUEST_URI}",
                                    "pattern": "!((^/(css|js|image|images)/)|(^/(book|topics|vip|bookcase|z|17k|pub|listen|suite|survey|help|userinfo))|(\\.(css|js|png|jpe?g|swf|gif|ico|php|s?html)$))"
                                }
                            ],
                            "rule": {
                                "pattern": "(.*)",
                                "substitution": "/index.php/$1",
                                "flag": "[L]"
                            }
                        },
                        {
                            "condition": [
                                {
                                    "test": "%{HTTP_HOST}",
                                    "pattern": "^i.vip.book.sina.com.cn"
                                },
                                {
                                    "test": "%{REMOTE_ADDR}",
                                    "pattern": "!^10\\.",
                                    "flag": "[NC]"
                                },
                                {
                                    "test": "%{REMOTE_ADDR}",
                                    "pattern": "!^172\\.16\\.",
                                    "flag": "[NC]"
                                },
                                {
                                    "test": "%{REMOTE_ADDR}",
                                    "pattern": "!^192\\.168\\.",
                                    "flag": "[NC]"
                                }
                            ],
                            "rule": {
                                "pattern": "^/.*$",
                                "substitution": "-",
                                "flag": "[F]"
                            }
                        }
                    ]
                }
            }
        ]
    },
    "changelog": "apache virtual host configuration of vip.book.sina.com.cn."
}
