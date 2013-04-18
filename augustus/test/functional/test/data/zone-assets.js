module.exports = [
    {
        "api": "/vatican/zone/create",
        "body": {
            "name": "zjm",
            "code": "mars",
            "isp": "CNC",
            "id": "010101",
            "subnet": {
                "internal":"10.44.6.0/24",
                "external":"10.43.6.0/24"
            }
        }
    },
    {
        "api": "/vatican/zone/create",
        "body": {
            "name": "zjm_with_resolvable_module_conflict",
            "code": "mars",
            "isp": "CNC",
            "id": "010101",
            "subnet": {
                "internal":"10.44.6.0/24",
                "external":"10.43.6.0/24"
            }
        }
    },
    {
        "api": "/vatican/zone/create",
        "body": {
            "name": "zjm_with_unresolvable_module_conflict",
            "code": "mars",
            "isp": "CNC",
            "id": "010101",
            "subnet": {
                "internal":"10.44.6.0/24",
                "external":"10.43.6.0/24"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.81",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.81",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars81",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.82",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.82",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars82",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.83",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.83",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars83",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.84",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.84",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars84",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.85",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.85",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars85",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.75",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.75",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars75",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.86",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.86",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars86",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    },
    {
        "api": "/vatican/assets/create",
        "body": {
            "addresses": [
	        {
                    "ip":"10.44.6.87",
		    "dev": "eth0"
		},
	        {
                    "ip":"10.43.6.87",
		    "dev": "eth1"
		}
            ],
	    "hostname": "mars87",
            "mem": 12288,
            "cpus": {
                "count":2,
                "cores":8,
                "hyper-threading":false,
                "frequency":2266,
                "model":"Intel(R) Xeon(R) CPU E5520 @ 2.27GHz"
            }
        }
    }
]
