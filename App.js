Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {
            xtype: 'container',
            itemId: 'exportBtn',
            cls: 'export-button'
        },
        {
            xtype: 'container',
            itemId: 'buildCombobox',
            cls: 'build-combo-box'
        },
        {
            xtype: 'container',
            itemId: 'vistaBuildCombobox',
            cls: 'vista-build-combo-box'
        },
        {
            xtype: 'container',
            itemId: 'environmentCombobox',
            cls: 'environment-combo-box'
        },
        {
            xtype: 'container',
            itemId: 'gridContainer'
        }
    ],
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Loading data..."});
        this._myMask.show();
        
        Ext.define('MyRally.util.Filter',{
            override : 'Ext.util.Filter',
            statics:{
                createFilterFn: function(filters) {
                    return filters && filters.length ? function(candidate) {
                        var isMatch = true,
                            length = filters.length,
                            i, filter;
                            
                        for (i = 0; isMatch && i < length; i++) {
                            filter = filters[i];
                            
                            if (!filter.disabled && filter.filterFn) {
                                isMatch = isMatch && filter.filterFn.call(filter.scope || filter, candidate);
                            }
                        }
                        return isMatch;
                    } : function() {
                        return true;
                    };
                }
            }
        });
        
        this.down('#environmentCombobox').add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'environmentComboBox',
            model: 'TestCaseResult',
            field: 'c_PhysicalEnvironment',
            value: 'FIT',
            listeners: {
                scope: this,
                select: this._onEnvironmentSelect,
                ready: this._initStore
            },
        });
    },
    _getEnvironmentFilter: function() {
        return {
            property: 'Environment',
            operator: '=',
            value: this.down('#environmentComboBox').getRawValue()
        };
    },
    _onEnvironmentSelect: function() {
        var store = this._grid.getStore();

        store.clearFilter(true);
        store.filter(this._getEnvironmentFilter());
    },
   _initStore: function() {
        this._defectsStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Defect',
            autoLoad: true,
            remoteSort: false,
            fetch:[
            	"FormattedID",
            	"State",
            	"TestCase"
        	],
            limit: Infinity
        });
        this._defectsStore.on('load',function () {
            this._testCaseStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'TestCase',
                autoLoad: true,
                remoteSort: false,
                fetch:[
            	    "FormattedID", 
                	"Name",
                	"Type",
                	"WorkProduct",
                	"Milestones",
                	"Defects",
                	"Results"
            	],
                limit: Infinity
            });

            this._testCaseStore.on('load',function () {
                Ext.create('Rally.data.wsapi.Store', {
                    model: 'TestCaseResult',
                    autoLoad: true,
                    remoteSort: false,
                    fetch: [
                        "Build",
                        "Date",
                        "TestCase",
                        "Tester",
                        "Verdict",
                        "c_PhysicalEnvironment",
                        "c_VistABuild",
                        "c_VistAInstance"
                    ],
                    limit: Infinity,
                    listeners: {
                        load: this._onDataLoaded,
                        scope: this
                    }
                });
            },this);
        },this);
    },
    _onDataLoaded: function(store, data) {
        _.each(data, function(testresult) {
            testresult.set("TesterName", testresult.data.Tester._refObjectName);
            testresult.set("Environment", testresult.data.c_PhysicalEnvironment);
            _.each(this._testCaseStore.data.items , function(testcase) {
                if (testcase.data._ref === testresult.data.TestCase._ref) {
                    testresult.set("TestCase", testcase);
                    testresult.set("TestCaseNumericID", Number(testcase.data.FormattedID.replace(/\D+/g, '')));
                    testresult.set("TestCaseName", testcase.data.Name);
                    testresult.set("TestCaseType", testcase.data.Type);
                    testresult.set("TestCaseWorkProduct", testcase.data.WorkProduct);
                    if (testcase.data.WorkProduct) {
                        testresult.set("TestCaseWorkProductNumericID", Number(testcase.data.WorkProduct.FormattedID.replace(/\D+/g, '')));
                    }
                    if (testcase.data.Defects && testcase.data.Defects.Count > 0) {
                        var allDefectHtml = [],
                            openDefectHtml = [];
                        _.each(this._defectsStore.data.items, function(defect) {
                            if (defect.data.TestCase && defect.data.TestCase.FormattedID === testcase.data.FormattedID) {
                                allDefectHtml.push('<a href="' + Rally.nav.Manager.getDetailUrl(defect) + '" target="_blank">' + defect.data.FormattedID + "</a> - " + defect.data.State);
                                if (defect.data.State !== "Closed" && 
                                    defect.data.State !== "VA-Awaiting Closure" &&
                                    defect.data.State !== "Awaiting Information from VA" &&
                                    defect.data.State !== "Awaiting CCB Decision" &&
                                    defect.data.State !== "Deferred") {
                                    openDefectHtml.push('<a href="' + Rally.nav.Manager.getDetailUrl(defect) + '" target="_blank">' + defect.data.FormattedID + "</a>");
                                }
                            }
                        }, this);
                        testresult.set('AllDefects', allDefectHtml.join("</br>"));
                        testresult.set('OpenDefects', openDefectHtml.join("</br>"));
                    }
                }
            }, this);
        }, this);
        this._makeGrid(data);
        this._onEnvironmentSelect();
    },

    _makeGrid: function(testcases){
        this._myMask.hide();
        var store = Ext.create('Rally.data.custom.Store', {
            data: testcases,
            storeId: 'customStore',
            proxy: {
                type:'memory'
            }
        });
        this._testcases = testcases;
        this._grid = Ext.create('Rally.ui.grid.Grid',{
            itemId: 'testcasesGrid',
            store: store,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: [
                { 
                	text: "Test Case ID", dataIndex: "TestCase", 
                	renderer : function(value) {
                	    return value ? '<a href="' + Rally.nav.Manager.getDetailUrl(value) + '" target="_blank">' + value.data.FormattedID + "</a>" : void 0;
                	},
                	 getSortParam: function() {
                        return 'TestCaseNumericID';  
                    }
                }, {
                    text: "Test Case Name", dataIndex: "TestCaseName", flex: 1
                }, {
                    text: "Test Case Type", dataIndex: "TestCaseType"
                }, {
                    text: "Work Product ID", dataIndex: "TestCaseWorkProduct",
                    renderer: function(value) {
                        return value ? '<a href="' + Rally.nav.Manager.getDetailUrl(value) + '" target="_blank">' + value.FormattedID + "</a>" : void 0;
                    },
                    getSortParam: function() {
                        return "TestCaseWorkProductNumericID";  
                    }
                }, {
                    text: "Test Results Build", dataIndex: "Build"
                }, {
                    text: "Test Results Date", dataIndex: "Date", xtype: 'datecolumn', format: 'D n/j/Y'
                }, {
                    text: "Test Results Tester", dataIndex: "TesterName"
                }, {
                    text: "Test Results Verdict", dataIndex: "Verdict", sortable: false
                }, {
                    text: "Test Results Physical Environment", dataIndex: "c_PhysicalEnvironment"
                }, {
                    text: "Test Results VistA Build", dataIndex: "c_VistABuild"
                }, {
                    text: "Test Results VistA Instance", dataIndex: "c_VistAInstance"
                }, {
                    text: "Defects", dataIndex: "AllDefects"
                }, {
                    text: "Open Defects", dataIndex: "OpenDefects"
                }
            ]
        });
        var thisRef = this;

        this.down('#buildCombobox').add({
            store: store,
            xtype: 'rallysearchcombobox',
            itemId: 'buildCombobox',
            model: 'TestCaseResult',
            valueField: 'Build',
            hideTrigger: true,
            noEntryText: '',
            emptyText: 'Filter By Build',
            autoSelect: false,
            submitEmptyText: false,
            forceSelection: false,
            clearFilterOnBlur: false,
            anyMatch: true,
            queryMode: 'local',
            submitValue: false,
            listeners: {
                'keyup': function(self, event) {
                    if(event.keyCode === 13) {
                        if (this.getRawValue() && this.getRawValue() !== "" && this.getRawValue() !== "All Builds") {
                            this.store.clearFilter(true);
                            if (thisRef.down('#vistaBuildCombobox').items.items[0].getRawValue() !== "All VistA Builds") {
                                this.store.filter([thisRef._getBuildFilter(), thisRef._getVistaBuildFilter(), thisRef._getEnvironmentFilter()]);
                            } else {
                                this.store.filter([thisRef._getBuildFilter(), thisRef._getEnvironmentFilter()]);
                            }
                        } else {
                            this.store.clearFilter(true);
                        }
                    }
                },
            },
        });
        
        this.down('#vistaBuildCombobox').add({
            store: store,
            xtype: 'rallysearchcombobox',
            itemId: 'vistaBuildCombobox',
            model: 'TestCaseResult',
            valueField: 'c_VistABuild',
            hideTrigger: true,
            noEntryText: '',
            emptyText: 'Filter By VistA Build',
            autoSelect: false,
            submitEmptyText: false,
            forceSelection: false,
            clearFilterOnBlur: false,
            anyMatch: true,
            queryMode: 'local',
            submitValue: false,
            listeners: {
                'keyup': function(self, event) {
                    if(event.keyCode === 13) {
                        if (this.getRawValue() && this.getRawValue() !== "" && this.getRawValue() !== "All VistA Builds") {
                            this.store.clearFilter(true);
                            this.store.filter([thisRef._getVistaBuildFilter(), thisRef._getEnvironmentFilter()]);
                        } else {
                            this.store.clearFilter(true);
                        }
                    }
                },
            },
        });

        this.down('#gridContainer').add(this._grid);
        this.down('#exportBtn').add({
            xtype: 'rallybutton',
            text: 'Export to CSV',
            href: 'data:text/csv;charset=utf8,' + encodeURIComponent(this._getCSV()),
            id: 'exportButton',
            scope: this
        });
        document.getElementById("exportButton").setAttribute("download","export.csv");
    },
    _getBuildFilter: function() {
        return {
            property: 'Build',
            value: this.down('#buildCombobox').items.items[0].getRawValue()
        };
    },
    _getVistaBuildFilter: function() {
        return {
            property: 'c_VistABuild',
            value: this.down('#vistaBuildCombobox').items.items[0].getRawValue()
        };
    },
    _getCSV: function () {
        var cols    = this._grid.columns;
        var data = '';

        _.each(cols, function(col) {
            data += this._getFieldTextAndEscape(col.text) + ',';
        }, this);
        data += "\r\n";

        _.each(this._testcases, function(record) {
            _.each(cols, function(col) {
                var fieldName = col.dataIndex;
                if (fieldName ==="WorkProduct" && record.data.WorkProduct) {
                    data += this._getFieldTextAndEscape(record.data.WorkProduct.FormattedID) + ',';
                } else if (fieldName === "TestCase") {
                    data += this._getFieldTextAndEscape(record.data.TestCase.data.FormattedID) + ',';
                } else if (fieldName ==="LastRun") {
                    var lastRunText = '';
                    if (record.data.LastRun) {
                        lastRunText = record.data.LastRun.toString();
                    }
                    data += this._getFieldTextAndEscape(lastRunText) + ',';
                } else if (fieldName === "AllDefects" && record.data.AllDefects) {
                    var text = '\"';
                    _.each(this._defectsStore.data.items, function(defect) {
                        if (defect.data.TestCase && defect.data.TestCase.FormattedID === record.data.TestCase.data.FormattedID) {
                            text += defect.data.FormattedID + ' - ' + defect.data.State + '\n';
                        }
                    }, this);
                    text += '\"';
                    data += text + ',';
                } else if (fieldName === "OpenDefects" && record.data.OpenDefects) {
                    var openDefectText = '\"';
                    _.each(this._defectsStore.data.items, function(defect) {
                        if (defect.data.TestCase && defect.data.TestCase.FormattedID === record.data.TestCase.data.FormattedID) {
                            if (defect.data.State !== "Closed" && 
                                    defect.data.State !== "VA-Awaiting Closure" &&
                                    defect.data.State !== "Awaiting Information from VA" &&
                                    defect.data.State !== "Awaiting CCB Decision" &&
                                    defect.data.State !== "Deferred") {
                                openDefectText += defect.data.FormattedID + '\n';
                            }
                        }
                    }, this);
                    openDefectText += '\"';
                    data += openDefectText + ',';
                } else if (fieldName === "Date") {
                     data += this._getFieldTextAndEscape(record.data.Date.toString()) + ',';
                } else if (fieldName === "TestCaseWorkProduct" && record.data.TestCaseWorkProduct) {
                     data += this._getFieldTextAndEscape(record.data.TestCaseWorkProduct.FormattedID) + ',';
                } else {
                    data += this._getFieldTextAndEscape(record.get(fieldName)) + ',';
                }
            }, this);
            data += "\r\n";
        }, this);

        return data;
    },
    _getFieldTextAndEscape: function(fieldData) {
        var string  = this._getFieldText(fieldData);  
        return this._escapeForCSV(string);
    },
    _getFieldText: function(fieldData) {
        var text;
        if (fieldData === null || fieldData === undefined || !fieldData.match) {
            text = '';
        } else if (fieldData._refObjectName) {
            text = fieldData._refObjectName;
        }else {
            text = fieldData;
        }
        return text;
    },
     _escapeForCSV: function(string) {
        if (string.match(/,/)) {
            if (!string.match(/"/)) {
                string = '"' + string + '"';
            } else {
                string = string.replace(/,/g, ''); 
            }
        }
        return string;
    }
});