#!/bin/bash

ulimit -n 131072
exec $@
