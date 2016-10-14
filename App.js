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
                                allDefectHtml.push('<a href="' + Rally.nav.Manager.getDetailUrl(defect) + '">' + defect.data.FormattedID + "</a> - " + defect.data.State);
                                if (defect.data.State !== "Closed" && 
                                    defect.data.State !== "VA-Awaiting Closure" &&
                                    defect.data.State !== "Awaiting Information from VA" &&
                                    defect.data.State !== "Awaiting CCB Decision" &&
                                    defect.data.State !== "Deferred") {
                                    openDefectHtml.push('<a href="' + Rally.nav.Manager.getDetailUrl(defect) + '">' + defect.data.FormattedID + "</a>");
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
        this.down('#gridContainer').add(this._grid);
        this.down('#exportBtn').add({
            xtype: 'rallybutton',
            text: 'Export to CSV',
            handler: this._onClickExport,
            scope: this
        });
    },

    _onClickExport: function(){
        var data = this._getCSV();
        window.location = 'data:text/csv;charset=utf8,' + encodeURIComponent(data);
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